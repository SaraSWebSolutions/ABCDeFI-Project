import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../database'; // adjust path to your sequelize instance

export class Referral extends Model {
  public id!: number;
  public referrerId!: string;
  public referredUserId?: string;
  public referralCode!: string;
  public readonly createdAt!: Date;
}

Referral.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    referrerId: { type: DataTypes.STRING, allowNull: false },
    referredUserId: { type: DataTypes.STRING, allowNull: true },
    referralCode: { type: DataTypes.STRING, allowNull: false, unique: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'referral', tableName: 'referrals', timestamps: false }
);

export default Referral;
