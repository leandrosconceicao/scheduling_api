import { EmployeeResponseDto } from "@application/dtos/employee_dto";
import { Request } from "express";

export interface IEmployerService {
    createEmployer(request: Request) : Promise<EmployeeResponseDto>;
    getEmployerById(request: Request) : Promise<EmployeeResponseDto>;
    updateEmployer(request: Request) : Promise<EmployeeResponseDto>;
    deleteEmployerById(request: Request) : Promise<EmployeeResponseDto>;
    getEmployers(request: Request) : Promise<EmployeeResponseDto>;
}