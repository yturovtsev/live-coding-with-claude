import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';

@Table({
  tableName: 'code_files',
  timestamps: false,
})
export class CodeFile extends Model {
  @PrimaryKey
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv4(),
  })
  id: string;

  @Column({
    type: DataType.TEXT,
    defaultValue: '',
  })
  code: string;

  @Column({
    type: DataType.STRING(32),
    defaultValue: 'typescript',
  })
  language: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  createdAt: Date;

  @Column({
    type: DataType.DATE,
    defaultValue: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // Срок действия 24 часа
  })
  expiresAt: Date;
}
