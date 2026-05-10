import { HealthController } from './health.controller';

describe('HealthController', () => {
  describe('getHealth', () => {
    const controller = new HealthController();

    it('should return health status with timestamp and uptime', () => {
      const result = controller.getHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });

    it('should return ISO string timestamp', () => {
      const result = controller.getHealth();
      const date = new Date(result.timestamp);

      expect(date.toISOString()).toBe(result.timestamp);
    });

    it('should return positive uptime', () => {
      const result = controller.getHealth();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
