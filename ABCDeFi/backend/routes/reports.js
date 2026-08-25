import express from 'express';
import workflow from '../services/lendingWorkflow.cjs';

const router = express.Router();
const { getReports } = workflow;

router.get('/', (req, res) => {
    res.json({ success: true, ...getReports() });
});

export default router;
