"use strict";
/**
 * Blockchain Explorer URL Generator
 * Generates explorer URLs for different cryptocurrencies and networks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockchainExplorerUrls = getBlockchainExplorerUrls;
exports.getTestnetExplorerUrls = getTestnetExplorerUrls;
/**
 * Get blockchain explorer URLs for a given cryptocurrency
 */
function getBlockchainExplorerUrls(crypto, txHash, address, network) {
    const urls = {};
    switch (crypto.toUpperCase()) {
        case 'BTC':
        case 'BITCOIN':
            if (txHash) {
                urls.transaction = `https://mempool.space/tx/${txHash}`;
                // Alternative explorers:
                // urls.transaction = `https://www.blockchain.com/btc/tx/${txHash}`;
                // urls.transaction = `https://blockchair.com/bitcoin/transaction/${txHash}`;
            }
            if (address) {
                urls.address = `https://mempool.space/address/${address}`;
            }
            break;
        case 'ETH':
        case 'ETHEREUM':
            if (txHash) {
                urls.transaction = `https://etherscan.io/tx/${txHash}`;
            }
            if (address) {
                urls.address = `https://etherscan.io/address/${address}`;
            }
            break;
        case 'USDT':
            // USDT can be on multiple chains
            if (network?.toLowerCase().includes('eth') || !network) {
                // Default to Ethereum
                if (txHash) {
                    urls.transaction = `https://etherscan.io/tx/${txHash}`;
                }
                if (address) {
                    urls.address = `https://etherscan.io/address/${address}`;
                }
            }
            else if (network?.toLowerCase().includes('tron') || network?.toLowerCase().includes('trc')) {
                if (txHash) {
                    urls.transaction = `https://tronscan.org/#/transaction/${txHash}`;
                }
                if (address) {
                    urls.address = `https://tronscan.org/#/address/${address}`;
                }
            }
            else if (network?.toLowerCase().includes('bsc')) {
                if (txHash) {
                    urls.transaction = `https://bscscan.com/tx/${txHash}`;
                }
                if (address) {
                    urls.address = `https://bscscan.com/address/${address}`;
                }
            }
            break;
        case 'USDC':
            // USDC is typically on Ethereum but can be on other chains
            if (network?.toLowerCase().includes('polygon')) {
                if (txHash) {
                    urls.transaction = `https://polygonscan.com/tx/${txHash}`;
                }
                if (address) {
                    urls.address = `https://polygonscan.com/address/${address}`;
                }
            }
            else if (network?.toLowerCase().includes('arbitrum')) {
                if (txHash) {
                    urls.transaction = `https://arbiscan.io/tx/${txHash}`;
                }
                if (address) {
                    urls.address = `https://arbiscan.io/address/${address}`;
                }
            }
            else {
                // Default to Ethereum
                if (txHash) {
                    urls.transaction = `https://etherscan.io/tx/${txHash}`;
                }
                if (address) {
                    urls.address = `https://etherscan.io/address/${address}`;
                }
            }
            break;
        case 'LTC':
        case 'LITECOIN':
            if (txHash) {
                urls.transaction = `https://blockchair.com/litecoin/transaction/${txHash}`;
            }
            if (address) {
                urls.address = `https://blockchair.com/litecoin/address/${address}`;
            }
            break;
        case 'BCH':
        case 'BITCOIN_CASH':
            if (txHash) {
                urls.transaction = `https://blockchair.com/bitcoin-cash/transaction/${txHash}`;
            }
            if (address) {
                urls.address = `https://blockchair.com/bitcoin-cash/address/${address}`;
            }
            break;
        case 'DOGE':
        case 'DOGECOIN':
            if (txHash) {
                urls.transaction = `https://blockchair.com/dogecoin/transaction/${txHash}`;
            }
            if (address) {
                urls.address = `https://blockchair.com/dogecoin/address/${address}`;
            }
            break;
        case 'XRP':
        case 'RIPPLE':
            if (txHash) {
                urls.transaction = `https://xrpscan.com/tx/${txHash}`;
            }
            if (address) {
                urls.address = `https://xrpscan.com/account/${address}`;
            }
            break;
        case 'TRX':
        case 'TRON':
            if (txHash) {
                urls.transaction = `https://tronscan.org/#/transaction/${txHash}`;
            }
            if (address) {
                urls.address = `https://tronscan.org/#/address/${address}`;
            }
            break;
        default:
            // For unknown cryptocurrencies, return empty URLs
            break;
    }
    return urls;
}
/**
 * Get testnet explorer URLs (for development/testing)
 */
function getTestnetExplorerUrls(crypto, txHash, address) {
    const urls = {};
    switch (crypto.toUpperCase()) {
        case 'BTC':
        case 'BITCOIN':
            if (txHash) {
                urls.transaction = `https://mempool.space/testnet/tx/${txHash}`;
            }
            if (address) {
                urls.address = `https://mempool.space/testnet/address/${address}`;
            }
            break;
        case 'ETH':
        case 'ETHEREUM':
            // Goerli testnet
            if (txHash) {
                urls.transaction = `https://goerli.etherscan.io/tx/${txHash}`;
            }
            if (address) {
                urls.address = `https://goerli.etherscan.io/address/${address}`;
            }
            break;
        default:
            // Return mainnet URLs as fallback
            return getBlockchainExplorerUrls(crypto, txHash, address);
    }
    return urls;
}
//# sourceMappingURL=blockchainExplorers.js.map