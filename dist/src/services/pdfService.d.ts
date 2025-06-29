export declare class PDFService {
    /**
     * Generate PDF for an invoice
     */
    static generateInvoicePDF(invoiceId: string): Promise<string>;
    /**
     * Get complete invoice data including items and user profile
     */
    private static getInvoiceData;
    /**
     * Generate HTML content for invoice PDF
     */
    private static generateInvoiceHTML;
    /**
     * Convert HTML to PDF using Puppeteer
     */
    private static convertHTMLToPDF;
    /**
     * Upload PDF to Supabase Storage
     */
    private static uploadPDFToStorage;
    /**
     * Download PDF for an invoice
     */
    static downloadInvoicePDF(invoiceId: string, userId: string): Promise<{
        buffer: Buffer;
        filename: string;
    }>;
}
//# sourceMappingURL=pdfService.d.ts.map