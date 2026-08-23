
import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { seedSuperAdmin, seedTesterAdmin, seedTesterDoctor } from "./app/utils/seed";
import { redisClient } from "./app/lib/redis";

const PORT = config.port;

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Prisma Connected Successfully")

		await redisClient.connect();
		console.log("Redis Connected Successfully")

		await seedSuperAdmin();
		await seedTesterAdmin();
		await seedTesterDoctor();

		console.log("Connected to the database successfully.");
		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();
