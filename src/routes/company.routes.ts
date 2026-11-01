import { Router } from "express";
import { container } from "tsyringe";
import multer from "multer";
import { validateAdminToken, validateOwnerToken, validateToken } from "@application";
import { CompanyController, EmployerController, ScheduleController } from "@controllers";

const companyRouter = Router();

const upload = multer();

const companyCtrl = container.resolve(CompanyController);
const employerCtrl = container.resolve(EmployerController);
const scheduleCtrl = container.resolve(ScheduleController);

companyRouter
    .post("/company", validateAdminToken, companyCtrl.create)
    .get("/company/search_domain", companyCtrl.searchSubdomain)
    .route("/company/:id")
    .patch(validateOwnerToken, companyCtrl.updateCompanyById)
    .get(validateToken, companyCtrl.getById)
    .delete(validateAdminToken, companyCtrl.deleteCompanyById)

companyRouter
    .route("/company/:companyId/employees")
    .get(validateOwnerToken, employerCtrl.getCompanyEmployers);

companyRouter
    .route("/company/employees/:companyId")
    .post(validateOwnerToken, employerCtrl.createEmployer)
    .get(validateToken, employerCtrl.getEmployers);

companyRouter.route("/company/employees/:companyId/:id")
    .get(validateOwnerToken, employerCtrl.getEmployerById)
    .patch(validateOwnerToken, employerCtrl.updateEmployer)
    .delete(validateOwnerToken, employerCtrl.deleteEmployerById)
    

companyRouter.route("/company/update_logo/:companyId")
    .put(validateOwnerToken, upload.single("file"), companyCtrl.uploadLogo);

companyRouter.route("/company/:companyId/schedules")
    .get(validateOwnerToken, scheduleCtrl.getCompanySchedules);

companyRouter.route("/company/:companyId/schedules/:id")
    .delete(validateOwnerToken, scheduleCtrl.cancelScheduleByCompany);

companyRouter.route("/company/:companyId/schedule_types")
    .get(validateOwnerToken, scheduleCtrl.getCompanyScheduleTypes);

export {companyRouter};