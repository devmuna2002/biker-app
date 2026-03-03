import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_sessions')
export class UserSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User)
    user: User;

    @Index({ unique: true })
    @Column({ type: 'uuid' })
    jti: string;

    @Column({ type: 'timestamp' })
    expiresAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    revokedAt: Date | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    ip: string | null;

    @Column({ type: 'varchar', length: 256, nullable: true })
    userAgent: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
