-- Restricciones que Prisma no expresa en schema.prisma. Se aplican tras `npm run db:push` y en el seed.
-- Respaldo de concurrencia: una sola reserva ACTIVA por vehículo.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_reservation ON "Reservation"("vehicleId") WHERE status = 'ACTIVA';

-- Respaldo de concurrencia: una sola venta CONFIRMADA por vehículo (las anuladas se conservan).
CREATE UNIQUE INDEX IF NOT EXISTS one_confirmed_sale ON "Sale"("vehicleId") WHERE status = 'CONFIRMADA';
