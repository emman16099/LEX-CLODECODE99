import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import usersRouter from "./users";
import employeesRouter from "./employees";
import attendanceRulesRouter from "./attendance-rules";
import attendanceRouter from "./attendance";
import adminRouter from "./admin";
import payrollRouter from "./payroll";
import cashAdvancesRouter from "./cash-advances";
import overtimeRouter from "./overtime";
import workRouter from "./work";
import workActivityRouter from "./work-activity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(usersRouter);
router.use(employeesRouter);
router.use(attendanceRulesRouter);
router.use(attendanceRouter);
router.use(adminRouter);
router.use(payrollRouter);
router.use(cashAdvancesRouter);
router.use(overtimeRouter);
router.use(workRouter);
router.use(workActivityRouter);

export default router;
