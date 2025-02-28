import { escrow } from "./constants";
import axios from "axios";
import { PublicKey, Connection, Transaction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID, createAssociatedTokenAccount, createAssociatedTokenAccountInstruction } from "@solana/spl-token"
// import { Wallet } from "lucide-react";
import { Wallet } from "@solana/wallet-adapter-react";

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
console.log("COnnection: ", connection);
const tokenMetadataCache = new Map();

async function getTokenMetadata(tokenSymbol: any) {
  if (tokenMetadataCache.has(tokenSymbol)) return tokenMetadataCache.get(tokenSymbol);
  try {
    const response = await axios.get('https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json');
    const tokenList = response.data.tokens;

    const token = tokenList.find((t: any) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase());
    if (token) {
      const metadata = {
        mint: token.address,
        decimals: token.decimals,
        name: token.name,
        symbol: token.symbol,
        logo: token.logoURI
      };

      tokenMetadataCache.set(tokenSymbol, metadata);
      return metadata;
    }
    throw new Error(`Token ${tokenSymbol} not found in registry`);
  } catch (e) {
    console.error('Failed to get token metadata: ', e);
    throw e;
  }
}

async function ensureTokenAddress(wallet: any, connection: Connection, payer: PublicKey, ownerAddress: PublicKey, tokenMint: PublicKey) {
  try {
    const tokenAddress = await getAssociatedTokenAddress(tokenMint, ownerAddress);

    try {
      // Check if account exists
      await connection.getTokenAccountBalance(tokenAddress);
      return tokenAddress;
    } catch (e) {
      // Create token account if it doesn't exist
      console.log("Creating associated token account...");
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer,
          tokenAddress,
          ownerAddress,
          tokenMint
        )
      );

      // Send transaction to create token account
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log("Before signature creation in ensureTOkenAddress");

      const signature = await wallet.sendTransaction(transaction, connection);
      console.log("Signature done");
      console.log("Signature", signature);
      // await connection.confirmTransaction(signature, 'confirmed');
      console.log("Created token account:", tokenAddress.toString());

      return tokenAddress;
    }
  } catch (error) {
    console.error("Error ensuring token address:", error);
    throw error;
  }
}

// utils/walletHelper.ts
export async function transferToken(wallet: any, tokenSymbol: string, amount: number) {
  console.log(`Transferring ${amount} ${tokenSymbol}...`);
  
  try {
    // For SOL transfers, use the working transferSOL function
    if (tokenSymbol === "SOL") {
      return await transferSOL(wallet, amount);
    }
    
    // For other tokens, use a simplified approach
    const tokenMetadata = await getTokenMetadata(tokenSymbol);
    if (!tokenMetadata) {
      return { success: false, error: `Token ${tokenSymbol} not found` };
    }
    
    // Calculate token amount with decimals
    const tokenAmount = Math.round(amount * Math.pow(10, tokenMetadata.decimals));
    
    // Get source and destination accounts
    const fromAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenMetadata.mint),
      wallet.publicKey
    );
    
    const escrowPubkey = new PublicKey(escrow);
    const toTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenMetadata.mint),
      escrowPubkey
    );
    
    // Create a transaction with skipPreflight to match your working SOL transfer
    const transaction = new Transaction();
    
    // First check if destination account exists
    if (!(await doesTokenAccountExist(connection, toTokenAccount))) {
      // Add instruction to create the token account first
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          toTokenAccount,
          escrowPubkey,
          new PublicKey(tokenMetadata.mint)
        )
      );
    }
    
    // Add the transfer instruction 
    transaction.add(
      createTransferInstruction(
        fromAccount,
        toTokenAccount,
        wallet.publicKey,
        tokenAmount
      )
    );
    
    // Set up transaction parameters (same as your working SOL transfer)
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Send with skipPreflight option like in your SOL transfer
    const options = { skipPreflight: true };
    const signature = await wallet.sendTransaction(transaction, connection, options);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error(`Error transferring ${tokenSymbol}:`, error);
    return { success: false, error: error.message };
  }
}

async function transferTokenByMint(wallet: any, tokenMint: string, amount: number, decimals: number) {
  try {
    const tokenAmount = amount * Math.pow(10, decimals);

    const fromAccount = await getAssociatedTokenAddress(new PublicKey(tokenMint),
      wallet.publicKey
    );

    const toTokenAccount = await ensureTokenAddress(
      wallet,                   // Pass wallet as the first parameter
      connection,
      wallet.publicKey,
      new PublicKey(escrow),
      new PublicKey(tokenMint)
    );
    console.log("From account: ", fromAccount);
    console.log("To account: ", toTokenAccount);

    await new Promise(resolve => setTimeout(resolve, 5000));

    const transferInstruction = createTransferInstruction(fromAccount, toTokenAccount, wallet.publicKey, Math.round(tokenAmount));

    const transaction = new Transaction().add(transferInstruction);

    // Add these lines to fix the timeout error
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Use options for better reliability
    // const options = { skipPreflight: false, preflightCommitment: 'confirmed' };
    console.log("BEfore signature creation in transferTokenByMint function");
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log("Signature done in transferTokenByMint function");

    // Wait for confirmation with a timeout
    // const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    console.log("Signature from transferTokenByMint function: ", signature);
    return { success: true, signature };
  } catch (error: any) {
    console.error("Error transferring tokens by mint:", error);
    // Check for specific error types
    if (error.name === 'TransactionExpiredTimeoutError') {
      return {
        success: false,
        error: "Transaction timed out. Please try again."
      };
    }
    return {
      success: false,
      error: error.message || "Unknown error"
    };
  }
}

export async function testConnection() {
  const { blockhash } = await connection.getLatestBlockhash();
  console.log(blockhash);
}

export async function testTokenMetadata(symbol = "USDC") {
  try {
    console.log("Testing token metadata for", symbol);
    const metadata = await getTokenMetadata(symbol);
    console.log("✅ Got token metadata:", metadata);
    return {
      success: true,
      metadata
    };
  } catch (error: any) {
    console.error("❌ Token metadata test failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function transferTokenWithAccountCreation(wallet: any, tokenMint: string, amount: number, decimals: number) {
  try {
    // Convert amount properly with Math.round
    const tokenAmount = Math.round(amount * Math.pow(10, decimals));
    
    // Set up accounts
    const fromAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenMint),
      wallet.publicKey
    );
    
    const escrowPubkey = new PublicKey(escrow);
    const toTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(tokenMint),
      escrowPubkey
    );
    
    // Check token account existence separately (don't combine transactions)
    const accountExists = await doesTokenAccountExist(connection, toTokenAccount);
    
    if (!accountExists) {
      // First create the account in a separate transaction
      const createTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          toTokenAccount,
          escrowPubkey,
          new PublicKey(tokenMint)
        )
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      createTx.recentBlockhash = blockhash;
      createTx.feePayer = wallet.publicKey;
      
      console.log("Creating token account...");
      const createSig = await wallet.sendTransaction(createTx, connection, { skipPreflight: true });
      console.log("Account created:", createSig);
      
      // Wait for confirmation before proceeding
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Now do the transfer in a separate transaction
    const transferTx = new Transaction().add(
      createTransferInstruction(
        fromAccount,
        toTokenAccount,
        wallet.publicKey,
        tokenAmount
      )
    );
    
    const { blockhash } = await connection.getLatestBlockhash();
    transferTx.recentBlockhash = blockhash;
    transferTx.feePayer = wallet.publicKey;
    
    console.log("Sending transfer...");
    const transferSig = await wallet.sendTransaction(transferTx, connection, { skipPreflight: true });
    
    return { success: true, signature: transferSig };
  } catch (error: any) {
    console.error("Transfer error:", error);
    return { success: false, error: error.message };
  }
}

// Helper function to check if token account exists
async function doesTokenAccountExist(connection: Connection, address: PublicKey) {
  try {
    const info = await connection.getAccountInfo(address);
    return info !== null;
  } catch (e) {
    return false;
  }
}

// Add this function to your file
export async function transferSOL(wallet: any, amount: number) {
  try {
    // Convert to lamports (SOL smallest unit)
    const lamports = Math.round(amount * 1e9);
    
    // Simple transaction with just a SOL transfer
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(escrow),
        lamports
      })
    );
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Send with skipPreflight to bypass some checks
    const options = { skipPreflight: true };
    const signature = await wallet.sendTransaction(transaction, connection, options);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error("SOL transfer error:", error);
    return { success: false, error: error.message };
  }
}



