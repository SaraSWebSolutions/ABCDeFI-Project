import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../database'; // adjust path to your sequelize instance

export class ReferralReward extends Model {
  public id!: number;
  public userId!: string;
  public rewardType!: 'ICO' | 'LENDING' | 'BORROWING';
  public amount!: string; // store as string to avoid precision loss
  public status!: 'PENDING' | 'CLAIMED';
  public loanId?: number;
  public icoPurchaseId?: number;
  public createdAt!: Date;
}

ReferralReward.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    rewardType: { type: DataTypes.ENUM('ICO', 'LENDING', 'BORROWING'), allowNull: false },
    amount: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM('PENDING', 'CLAIMED'), defaultValue: 'PENDING', allowNull: false },
    loanId: { type: DataTypes.INTEGER, allowNull: true },
    icoPurchaseId: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'referral_reward', tableName: 'referral_rewards', timestamps: false }
);

export default ReferralReward;
