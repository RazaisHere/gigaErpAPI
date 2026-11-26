import { ConflictException } from '@nestjs/common';
import { SlaRulesService } from './sla-rules.service';

describe('SlaRulesService', () => {
  const rules = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: '5', ...x })),
  };
  let service: SlaRulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SlaRulesService(rules as never);
  });

  it('lists rules', async () => {
    rules.find.mockResolvedValue([
      {
        id: '1',
        name: 'Normal',
        priority: 'Normal',
        targetHours: 48,
        escalateAtPercent: 80,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const rows = await service.findAll();
    expect(rows[0].priority).toBe('Normal');
  });

  it('create rejects duplicate priority', async () => {
    rules.findOne.mockResolvedValue({ id: '1', priority: 'High' });
    await expect(
      service.create({ name: 'High', priority: 'High', targetHours: 24 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
