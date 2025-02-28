import { Keypair } from "@solana/web3.js";

const escrowWallet = Keypair.generate();

export const escrow = escrowWallet.publicKey.toString();