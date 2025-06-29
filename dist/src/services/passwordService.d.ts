export declare class PasswordService {
    static hash(password: string): Promise<string>;
    static verify(password: string, hash: string): Promise<boolean>;
    static validatePassword(password: string): void;
}
//# sourceMappingURL=passwordService.d.ts.map