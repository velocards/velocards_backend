interface EmailOptions {
    to: string;
    from: {
        email: string;
        name: string;
    };
    subject: string;
    text: string;
    html: string;
    attachments?: any[];
}
/**
 * Email Provider Manager
 * Automatically selects the first configured provider
 */
export declare class EmailProviderManager {
    private providers;
    private activeProvider;
    constructor();
    getActiveProvider(): string;
    send(options: EmailOptions): Promise<void>;
}
export declare const emailProvider: EmailProviderManager;
export {};
//# sourceMappingURL=emailProvider.d.ts.map