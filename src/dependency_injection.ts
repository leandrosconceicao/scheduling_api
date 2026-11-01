import { container } from "tsyringe";
import { ICacheService, ICloudService, ICompanyRepository, ICompanyService, IEmployerRepository, IEmployerService, IOwnerRepository, IOwnerService, IScheduleRepository, IScheduleService } from "@domain";
import { CompanyRepository, ScheduleRepository, EmployerRepository, OwnerRepository } from "@repository";
import { CompanyService, ScheduleService, EmployerService, CloudService, CacheService, OwnerService } from "@application";

container.register<ICompanyRepository>("ICompanyRepository", CompanyRepository);
container.register<IScheduleRepository>("IScheduleRepository", ScheduleRepository);
container.register<IEmployerRepository>("IEmployerRepository", EmployerRepository);
container.register<IOwnerRepository>("IOwnerRepository", OwnerRepository);
container.register<ICompanyService>("ICompanyService", CompanyService);
container.register<IScheduleService>("IScheduleService", ScheduleService);
container.register<IEmployerService>("IEmployerService", EmployerService);
container.register<IOwnerService>("IOwnerService", OwnerService);
container.register<ICloudService>("ICloudService", CloudService);
container.register<ICacheService>("ICacheService", CacheService);