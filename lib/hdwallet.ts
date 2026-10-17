import { mnemonicToAccount } from "viem/accounts";

/**
 * Dérive l'adresse de dépôt à l'index donné (chemin m/44'/60'/0'/0/{index}).
 * Seule l'adresse est utilisée : la clé privée n'est jamais exposée.
 */
export function deriveDepositAddress(addressIndex: number): `0x${string}` {
  const mnemonic = process.env.HD_WALLET_MNEMONIC;
  if (!mnemonic) throw new Error("HD_WALLET_MNEMONIC manquant dans .env");
  return mnemonicToAccount(mnemonic, { addressIndex }).address;
}
