export declare class EmailService {
    /**
     * Check if email service is ready
     */
    static isReady(): boolean;
    /**
     * Send invoice email to user
     */
    static sendInvoiceEmail(invoiceId: string): Promise<void>;
    /**
     * Get invoice data for email
     */
    private static getInvoiceEmailData;
    /**
     * Generate invoice email template
     */
    private static generateInvoiceEmailTemplate;
    /**
     * Send email using configured provider
     */
    private static sendEmail;
    /**
     * Log email sent to database
     */
    private static logEmailSent;
    /**
     * Resend invoice email
     */
    static resendInvoiceEmail(invoiceId: string, userId: string): Promise<void>;
    /**
     * Send test email (for setup verification)
     */
    static sendTestEmail(to: string): Promise<void>;
}
//# sourceMappingURL=emailService.d.ts.map