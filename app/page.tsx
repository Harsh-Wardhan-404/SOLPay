"use client";

import { Connection, PublicKey, Transaction, VersionedTransaction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet2, ArrowRight, RefreshCw } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { escrow } from "@/utils/constants";
import { testConnection, testTokenMetadata, transferToken, transferSOL } from "@/utils/walletHelper";

interface SwapInfo {
  ammKey: string;
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
}

interface RoutePlan {
  swapInfo: SwapInfo;
  percent: number;
}

interface QuoteResponse {
  routePlan: RoutePlan[];
}

interface Token {
  symbol: string;
  name: string;
  logo: string;
  mint: string;
  decimals: number;
  balance?: number;
}

const tokens = [
  { symbol: "ETH", name: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png" },
  { symbol: "USDT", name: "Tether", logo: "https://cryptologos.cc/logos/tether-usdt-logo.png" },
  { symbol: "BNB", name: "Binance Coin", logo: "https://cryptologos.cc/logos/bnb-bnb-logo.png" },
  { symbol: "MATIC", name: "Polygon", logo: "https://cryptologos.cc/logos/polygon-matic-logo.png" },
  { symbol: "SOL", name: "Solana", logo: "https://cryptologos.cc/logos/solana-sol-logo.png" }
];



export default function Home() {
  const [availableTokens, setAvailableTokens] = useState<Token[]>([]);
  const [walletTokensLoading, setWalletTokensLoading] = useState(false);
  const [tokenMetadataCache, setTokenMetadataCache] = useState<Record<string, any>>({});
  const [rawAmt, setRawAmt] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [solTestResult, setSolTestResult] = useState<{ success: boolean, message: string, signature?: string } | null>(null);
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [convertedAmt, setConvertedAmt] = useState<Number>();
  const [selectedToken, setSelectedToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputToken, setInputToken] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [connection, setConnection] = useState<Connection>();
  const MAINNET_MODE = true; // Set this to true for hackathon submission
  const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Real USDC on mainnet
  const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";

  useEffect(() => {
    if (wallet.connected) {
      // setConnection(new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com", { commitment: 'confirmed', confirmTransactionInitialTimeout: 60000 }));
      setConnection(new Connection(
        MAINNET_MODE
          ? "https://api.mainnet-beta.solana.com"
          : (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"),
        { commitment: 'confirmed' }
      ));
      checkWalletTokens();
    }
  }, [wallet.connected]);

  const fetchTokenPrice = async (amount: string) => {
    console.log(`Converting ${amount} USD to SOL ...`);

    const usdc = (Number(amount) * 1_000_000).toString();
    console.log("Inside the fetchTokenPrice function , USDC price after converting: ", usdc);
    const response = await fetch(
      `https://api.jup.ag/swap/v1/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=${usdc}&slippageBps=50&swapMode=ExactIn&asLegacyTransaction=false&maxAccounts=64`

    );
    const quoteResponse: QuoteResponse = await response.json();
    setRawAmt(quoteResponse.routePlan[quoteResponse.routePlan.length - 1].swapInfo.outAmount);
    console.log("Raw amount: ", quoteResponse.routePlan[quoteResponse.routePlan.length - 1].swapInfo.outAmount);
    const converted = Number(quoteResponse.routePlan[quoteResponse.routePlan.length - 1].swapInfo.outAmount) / 1e9;
    setConvertedAmt(converted);
    console.log(`${amount} USD = ${converted} SOL`);
    // console.log(JSON.stringify(quoteResponse, null, 2));
  }

  const handlePayment = async () => {
    if (!selectedToken || !amount || !wallet.connected) return;
    setLoading(true);
    const token = availableTokens.find(t => t.symbol === selectedToken);
    if (!token) return;
    const amountToSend = selectedToken === "SOL"
      ? Number(convertedAmt)
      : Number(amount);
    const merchantUSDCTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      new PublicKey(receiverAddress),
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("merchantUSDCTokenAccount:", merchantUSDCTokenAccount.toString());
    try {
      console.log("Inside handle payment , before sending to processPayment fn");
      console.log("Receiver's address: ", receiverAddress);
      const result = await processPayment(token.mint, Number(amount), receiverAddress);
      console.log("Inside handle payment , after sending to processPayment fn");
      if (result && result.success) {
        setTxSignature(result.signature || "");
        setTxStatus("success");
        console.log(`Successfully transferred ${amountToSend} ${selectedToken}`, result.signature);
        alert(`Successfully sent ${amountToSend} ${selectedToken} to escrow!`);
      } else {
        setTxStatus("error");
        throw new Error(`Transfer failed: ${result.error}`);
      }
    }
    catch (error: any) {
      console.error("Error in handlePayment:", error);
      alert(`Payment failed: ${error.message}`);
      setTxStatus("error");
    } finally {
      setLoading(false);
    }

  };

  const testSolTransfer = async () => {
    if (!wallet.connected) {
      alert("Please connect your wallet first");
      return;
    }

    setSolTestResult({ success: false, message: "Processing SOL transfer..." });
    try {
      // Send a small amount of SOL (0.001) for testing
      const result = await transferSOL(wallet, 0.001);

      if (result.success) {
        setSolTestResult({
          success: true,
          message: "SOL transfer successful!",
          signature: result.signature
        });
        console.log("Transfer successful with signature:", result.signature);
      } else {
        setSolTestResult({
          success: false,
          message: `Transfer failed: ${result.error}`
        });
      }
    } catch (error: any) {
      setSolTestResult({
        success: false,
        message: `Error: ${error.message}`
      });
    }
  };

  const sendToEscrow = async (amount: string) => {
    // your existing function with modifications:
    if (!wallet.publicKey) {
      alert("No wallet attached");
      return;
    }

    try {
      setLoading(true);
      setTxStatus("pending");

      // Get the token object
      const token = availableTokens.find(t => t.symbol === selectedToken);
      if (!token) {
        throw new Error(`Selected token ${selectedToken} not found`);
      }

      const amountToSend = selectedToken === "SOL"
        ? Number(convertedAmt)
        : Number(amount);

      const result = await transferToken(
        wallet, selectedToken, amountToSend
      );

      if (result.success) {
        setTxSignature(result.signature);
        setTxStatus("success");
        console.log(`Successfully transferred ${amountToSend} ${selectedToken}`, result.signature);
        alert(`Successfully sent ${amountToSend} ${selectedToken}!`);
      } else {
        setTxStatus("error");
        throw new Error(`Transfer failed: ${result.error}`);
      }
    }
    catch (error: any) {
      console.error("Error in Transfer Token:", error);
      alert(`Failed to send ${selectedToken}: ${error.message}`);
      setTxStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenMetadata = async (mint: string): Promise<Token | null> => {
    if (tokenMetadataCache[mint]) {
      return tokenMetadataCache[mint];
    }

    try {
      // First try to get from the token list API
      const response = await fetch(
        "https://lite-api.jup.ag/tokens/v1/tagged/verified"
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch token list: ${response.status}`);
      }

      const tokenList = await response.json();
      console.log("Token list from Jup API", tokenList)
      const token = tokenList.tokens.find((t: any) => t.address === mint);

      if (token) {
        const tokenData: Token = {
          symbol: token.symbol,
          name: token.name,
          logo: token.logoURI || "https://cryptologos.cc/logos/question-mark.png",
          mint: token.address,
          decimals: token.decimals
        };

        // Cache the result
        setTokenMetadataCache(prev => ({
          ...prev,
          [mint]: tokenData
        }));

        return tokenData;
      }

      // If not found in the token list, create a basic entry
      const unknownToken: Token = {
        symbol: mint.substring(0, 4) + "...",
        name: "Unknown Token",
        logo: "https://cryptologos.cc/logos/question-mark.png",
        mint: mint,
        decimals: 9 // Assume 9 decimals as default
      };

      setTokenMetadataCache(prev => ({
        ...prev,
        [mint]: unknownToken
      }));

      return unknownToken;
    } catch (error) {
      console.error("Error fetching token metadata:", error);
      return null;
    }
  };

  const checkWalletTokens = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setAvailableTokens([solToken]);
      return;
    }

    setWalletTokensLoading(true);
    try {

      const walletTokens: Token[] = [];

      // Get SOL balance
      const solBalance = await connection?.getBalance(wallet.publicKey);
      if (solBalance && solBalance > 0) {
        walletTokens.push({
          ...solToken,
          balance: solBalance / 1e9
        });
      }

      // Get all token accounts
      const tokenAccounts = await connection?.getParsedTokenAccountsByOwner(
        wallet.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      console.log(`Found ${tokenAccounts?.value.length} token accounts in wallet`);

      // Process each token account
      for (const account of tokenAccounts?.value || []) {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount.uiAmount;

        // Only add tokens with positive balance
        if (balance > 0) {
          // Fetch metadata for this token
          const tokenMetadata = await fetchTokenMetadata(mint);

          if (tokenMetadata) {
            walletTokens.push({
              ...tokenMetadata,
              balance
            });
          } else {
            // If metadata fetch fails, add a basic entry
            walletTokens.push({
              symbol: mint.substring(0, 4) + "...",
              name: "Unknown Token",
              logo: "https://cryptologos.cc/logos/question-mark.png",
              mint: mint,
              decimals: parsedInfo.tokenAmount.decimals,
              balance
            });
          }
        }
      }

      if (walletTokens.length === 0) {
        // Always include SOL as an option even if balance is 0
        walletTokens.push(solToken);
      }

      console.log("Available tokens in wallet:", walletTokens);
      setAvailableTokens(walletTokens);

      // If we had a selected token but it's no longer available, reset selection
      if (selectedToken && !walletTokens.find(t => t.symbol === selectedToken)) {
        setSelectedToken("");
      }

    } catch (error) {
      console.error("Error checking wallet tokens:", error);
      // Fall back to just SOL
      setAvailableTokens([solToken]);
    } finally {
      setWalletTokensLoading(false);
    }
  };

  const processPayment = async (inputTokenMint: string, inputAmount: number, receiverAddress: string) => {
    try {
      if (!wallet.publicKey || !connection) {
        return { success: false, error: "Wallet not connected" };
      }

      setTxStatus("pending");

      // 1. Create the receiver's USDC token account if needed
      const receiverUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        new PublicKey(receiverAddress)
      );

      let accountCreationSignature = null;

      try {
        const accountInfo = await connection.getAccountInfo(receiverUsdcAccount);
        if (!accountInfo) {
          console.log("Creating receiver USDC account...");
          const createAccountTx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              receiverUsdcAccount,
              new PublicKey(receiverAddress),
              USDC_MINT
            )
          );

          accountCreationSignature = await wallet.sendTransaction(createAccountTx, connection);
          await connection.confirmTransaction(accountCreationSignature);
          console.log("Account created:", accountCreationSignature);
        }
      } catch (error) {
        console.log("Account might already exist:", error);
        // Continue anyway - the account might exist already
      }

      // 2. Get quote from Jupiter
      const amountToSwap = inputTokenMint === "So11111111111111111111111111111111111111112"
        ? Math.floor(inputAmount * 1_000_000_000) // SOL has 9 decimals
        : Math.floor(inputAmount * Math.pow(10, 6)); // Assuming other token has 6 decimals

      const quoteUrl = `https://quote-api.jup.ag/v6/quote?` +
        `inputMint=${inputTokenMint}&` +
        `outputMint=${USDC_MINT.toString()}&` +
        `amount=${amountToSwap}&` +
        `slippageBps=50`;

      console.log("Getting quote from:", quoteUrl);

      const response = await fetch(quoteUrl);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Quote API error: ${response.status} - ${errorText}`);
      }

      const quoteResponse = await response.json();
      console.log("Quote received:", quoteResponse);

      // 3. Get swap transaction
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey.toString(),
          destinationTokenAccount: receiverUsdcAccount.toString()
        })
      });

      if (!swapResponse.ok) {
        const errorData = await swapResponse.text();
        throw new Error(`Swap API error: ${swapResponse.status} - ${errorData}`);
      }

      const swapData = await swapResponse.json();
      console.log("Swap transaction received");

      if (!swapData.swapTransaction) {
        throw new Error("No swap transaction received");
      }

      // 4. Execute the transaction
      const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');

      // For versioned transactions
      let transaction;
      try {
        transaction = VersionedTransaction.deserialize(new Uint8Array(swapTransactionBuf));
      } catch (e) {
        // Fall back to legacy transaction
        transaction = Transaction.from(swapTransactionBuf);
      }

      console.log("Sending transaction...");
      const swapSignature = await wallet.sendTransaction(transaction, connection);
      console.log("Transaction sent:", swapSignature);

      // 5. Wait for confirmation
      const confirmationResult = await connection.confirmTransaction(swapSignature);
      console.log("Transaction confirmed:", confirmationResult);

      setTxStatus("success");
      return { success: true, signature: swapSignature };
    } catch (error) {
      console.error("Payment processing failed:", error);
      setTxStatus("error");
      return { success: false, error };
    }
  };

  const directSolPayment = async (amount: number, receiverAddress: string) => {
    try {
      if (!wallet.publicKey || !connection) {
        return { success: false, error: "Wallet not connected" };
      }

      // This is a fallback that just sends SOL directly - useful if Jupiter is down
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(receiverAddress),
          lamports: Math.floor(amount * 1_000_000_000),
        })
      );

      const signature = await wallet.sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature);

      return { success: true, signature };
    } catch (error) {
      console.error("Direct payment failed:", error);
      return { success: false, error };
    }
  };

  const solToken: Token = {
    symbol: "SOL",
    name: "Solana",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9
  };

  useEffect(() => {
    if (selectedToken == "SOL" && amount) {
      fetchTokenPrice(amount);
    }
  }, [selectedToken, amount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-900 py-16 px-4 sm:px-6 lg:px-8 text-white">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">SOLPay</h1>
          <p className="mt-3 text-gray-300">Pay with any token, recipient receive USDC</p>
        </div>

        <Card className="p-6 backdrop-blur-sm bg-black/30 shadow-2xl rounded-xl border border-gray-800">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount (USD)
              </label>
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
                className="w-full bg-gray-900/70 border-gray-800 text-white focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Receiver's Address (USDC)
              </label>
              <Input
                type="text"
                value={receiverAddress}
                onChange={(e) => {
                  setReceiverAddress(e.target.value);
                }}
                className="w-full bg-gray-900/70 border-gray-800 text-white focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Token
              </label>
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger className="w-full bg-gray-900/70 border-gray-800 text-white">
                  <SelectValue placeholder={
                    walletTokensLoading
                      ? "Loading wallet tokens..."
                      : !wallet.connected
                        ? "Connect wallet to see tokens"
                        : "Select token to pay with"
                  } />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  {availableTokens.map((token) => (
                    <SelectItem
                      key={token.mint}
                      value={token.symbol}
                      className="focus:bg-green-900/40 focus:text-white hover:bg-green-900/40 hover:text-white data-[highlighted]:bg-green-900/40 data-[highlighted]:text-white"
                    >
                      <div className="flex items-center justify-between w-full group">
                        <div className="flex items-center">
                          <img src={token.logo} alt={token.name} className="w-6 h-6 mr-2" />
                          <span className="group-hover:text-white">{token.symbol}</span>
                        </div>
                        {token.balance !== undefined && (
                          <span className="text-xs text-gray-400 ml-2 group-hover:text-white">
                            {token.balance.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedToken && amount && (
              <div className="bg-gray-900/50 p-5 rounded-lg border border-gray-800 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">You pay</span>
                  {priceLoading ? (
                    <span className="font-medium text-gray-400 flex items-center">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Loading...
                    </span>
                  ) : priceError ? (
                    <span className="font-medium text-red-400">Error loading price</span>
                  ) : (
                    <span className="font-medium text-green-400">{`≈ ${convertedAmt?.toFixed(6)} ${selectedToken}`}</span>
                  )}
                </div>
                <div className="flex justify-center my-3">
                  <div className="bg-gray-800/50 p-2 rounded-full">
                    <ArrowRight className="text-green-400 h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Recipient receives</span>
                  <span className="font-medium text-green-400">{`${amount} USDC`}</span>
                </div>
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-2 transition-all duration-300 shadow-lg"
              onClick={handlePayment}
              disabled={!amount || !selectedToken || loading || !wallet.connected || priceLoading}
            >
              {loading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wallet2 className="mr-2 h-4 w-4" />
              )}
              {!wallet.connected
                ? "Connect Wallet"
                : loading
                  ? "Processing..."
                  : "Pay Now"}
            </Button>

            {wallet.connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={checkWalletTokens}
                disabled={walletTokensLoading}
                className="w-full mt-2 border-gray-800 text-gray-300 hover:bg-gray-800/50 hover:text-white"
              >
                {walletTokensLoading ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2" /> Refresh Tokens
                  </>
                )}
              </Button>
            )}

          </div>
        </Card>

        {/* Transaction status display */}
        {txStatus !== "idle" && (
          <div className={`mt-6 p-5 rounded-lg backdrop-blur-sm shadow-lg border ${txStatus === "pending" ? "bg-yellow-900/20 border-yellow-800 text-yellow-300" :
            txStatus === "success" ? "bg-green-900/20 border-green-800 text-green-300" :
              "bg-red-900/20 border-red-800 text-red-300"
            }`}>
            <p className="font-medium">
              {txStatus === "pending" && "Transaction in progress..."}
              {txStatus === "success" && "Payment successful!"}
              {txStatus === "error" && "Payment failed, please try again."}
            </p>

            {txSignature && (
              <p className="text-xs mt-3">
                Transaction ID: {txSignature.slice(0, 10)}...
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline text-green-300 hover:text-green-200"
                >
                  View on Explorer
                </a>
              </p>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <div className="p-4 inline-block rounded-full bg-black/30 backdrop-blur-sm">
            <p className="text-sm text-gray-400">Powered by Jupiter Swap & Solana</p>
          </div>
        </div>

        {/* Test buttons are hidden by default for production */}

        {/* Test transfer result */}
        {solTestResult && (
          <div className={`mt-6 p-4 rounded-lg backdrop-blur-sm shadow-lg ${solTestResult.success ? 'bg-green-900/20 border border-green-800 text-green-300' : 'bg-red-900/20 border border-red-800 text-red-300'}`}>
            <p>{solTestResult.message}</p>
            {solTestResult.signature && (
              <p className="text-xs mt-2">
                Signature: {solTestResult.signature.substring(0, 12)}...
                <a
                  href={`https://explorer.solana.com/tx/${solTestResult.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline text-green-300 hover:text-green-200"
                >
                  View on Explorer
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}