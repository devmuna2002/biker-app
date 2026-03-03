import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('trusted_contacts')
export class TrustedContact {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User)
    user: User;

    @Column()
    name: string;

    @Column()
    phone: string;

    @Column({ default: true })
    isActive: boolean;
}
