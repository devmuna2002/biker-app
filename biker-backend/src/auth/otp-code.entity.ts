import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum OtpPurpose {
    LOGIN = 'login',
    PHONE_VERIFICATION = 'phone_verification',
    EMAIL_VERIFICATION = 'email_verification',
    PASSWORD_RESET = 'password_reset',
}

@Entity('otp_codes')
export class OtpCode {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    role: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string;

    @Column({ type: 'varchar', length: 150, nullable: true })
    email: string;

    @Column({ type: 'varchar', length: 6 })
    code: string;

    @Column({ type: 'enum', enum: OtpPurpose, default: OtpPurpose.LOGIN })
    purpose: OtpPurpose;

    @Column({ type: 'boolean', default: false })
    used: boolean;

    @Column({ name: 'expires_at', type: 'timestamp' })
    expiresAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
