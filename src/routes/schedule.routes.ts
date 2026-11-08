
import { validateOwnerToken, validateToken } from "@application";
import { ScheduleController } from "@controllers";
import { ICloudService } from "@domain";
import { Router } from "express";
import { container } from "tsyringe";

const scheduleRouter = Router();

const scheduleCtrl = container.resolve(ScheduleController);
const cloudService = container.resolve<ICloudService>("ICloudService");

scheduleRouter.route("/lock_schedule/:companyId")
    .post(validateToken, scheduleCtrl.lockSchedule, cloudService.sendEventlockSchedule)
    .delete(validateToken, scheduleCtrl.deleteLockSchedule, cloudService.sendEventlockSchedule);


// Agendamentos do cliente em todas as empresas. Precisa vir antes de "/schedules/:companyId" para "me" não ser tratado como id
scheduleRouter.route("/schedules/me")
    .get(validateToken, scheduleCtrl.getClientSchedules);

scheduleRouter.route("/schedules/:companyId")
    .get(validateToken, scheduleCtrl.getSchedules)
    .post(validateToken, scheduleCtrl.createSchedule, scheduleCtrl.sendEventSchedule);

scheduleRouter.route("/schedules/types/:companyId")
    .get(validateToken, scheduleCtrl.getScheduleTypes)
    .post(validateOwnerToken, scheduleCtrl.addNewScheduleType)

scheduleRouter.route("/schedules/types/:companyId/:id")
    .delete(validateOwnerToken, scheduleCtrl.deleteScheduleType)
    .patch(validateOwnerToken, scheduleCtrl.updateScheduleType)

// Precisa vir antes de "/schedules/:companyId/:id" para "me" não ser tratado como id
scheduleRouter.route("/schedules/:companyId/me")
    .get(validateToken, scheduleCtrl.getClientSchedules);

scheduleRouter.route("/schedules/:companyId/:id")
    .get(validateToken, scheduleCtrl.getScheduleById)
    .delete(validateToken, scheduleCtrl.cancelSchedule);


export {scheduleRouter};