import express from 'express';
import { GridControllers } from './grid.controller';
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = express.Router();

router.post('/authority', auth(Role.ADMIN, Role.SUPER_ADMIN), GridControllers.createPowerAuthority);
router.post('/zone', auth(Role.ADMIN, Role.SUPER_ADMIN), GridControllers.createZone);
router.post('/substation', auth(Role.ADMIN, Role.SUPER_ADMIN), GridControllers.createSubstation);
router.post('/feeder', auth(Role.ADMIN, Role.SUPER_ADMIN), GridControllers.createFeeder);
router.post('/area', auth(Role.ADMIN, Role.SUPER_ADMIN), GridControllers.createArea);

export const GridRoutes = router;
