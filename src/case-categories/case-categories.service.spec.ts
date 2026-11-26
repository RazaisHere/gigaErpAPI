import { ConflictException, NotFoundException } from '@nestjs/common';
import { CaseCategoriesService } from './case-categories.service';

describe('CaseCategoriesService', () => {
  const categories = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: '10', ...x })),
  };
  const departments = { findOne: jest.fn() };
  let service: CaseCategoriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CaseCategoriesService(
      categories as never,
      departments as never,
    );
  });

  it('lists categories', async () => {
    categories.find.mockResolvedValue([
      {
        id: '1',
        name: 'Other',
        defaultDepartment: { id: '2', name: 'CCS', code: 'CCS' },
        defaultSlaHours: 48,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const rows = await service.findAll();
    expect(rows[0].name).toBe('Other');
    expect(rows[0].defaultDepartment?.code).toBe('CCS');
  });

  it('create rejects duplicate name', async () => {
    categories.findOne.mockResolvedValue({ id: '1', name: 'Other' });
    await expect(
      service.create({ name: 'Other', defaultDepartmentId: '2' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne throws when missing', async () => {
    categories.findOne.mockResolvedValue(null);
    await expect(service.findOne('99')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
