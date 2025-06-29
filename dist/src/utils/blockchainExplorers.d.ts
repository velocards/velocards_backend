/**
 * Blockchain Explorer URL Generator
 * Generates explorer URLs for different cryptocurrencies and networks
 */
export interface ExplorerUrls {
    transaction?: string;
    address?: string;
}
/**
 * Get blockchain explorer URLs for a given cryptocurrency
 */
export declare function getBlockchainExplorerUrls(crypto: string, txHash?: string, address?: string, network?: string): ExplorerUrls;
/**
 * Get testnet explorer URLs (for development/testing)
 */
export declare function getTestnetExplorerUrls(crypto: string, txHash?: string, address?: string): ExplorerUrls;
//# sourceMappingURL=blockchainExplorers.d.ts.map