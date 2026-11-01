import { validateAdminToken, validateOwnerToken } from "@application";
import { OwnerController } from "@controllers";
import { Router } from "express";
import { container } from "tsyringe";

const ownerRouter = Router();

const ownerController = container.resolve(OwnerController);

ownerRouter.post("/owner", validateAdminToken, ownerController.create);
ownerRouter.post("/owner/auth", ownerController.authenticate);

ownerRouter.route("/owner/:id")
    .patch(validateOwnerToken, ownerController.update)
    .delete(validateAdminToken, ownerController.delete);

export {ownerRouter};
