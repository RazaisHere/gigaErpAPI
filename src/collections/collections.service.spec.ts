import { NotFoundException } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { RequestUser } from '../auth/types/jwt-payload';

const superadmin: RequestUser = {
  id: '1',
  name: 'Ali',
  email: 'a@x.com',
  status: 'active',
  mustChangePassword: false,
  roleCode: 'superadmin',
  roleName: 'Superadmin',
  departmentId: null,
  departmentCode: null,
  departmentName: null,
  isDepartmentAdmin: false,
};

describe('CollectionsService', () => {
  const source = { query: jest.fn() };
  const categories = { findOne: jest.fn() };
  const cases = { create: jest.fn() };
  let service: CollectionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CollectionsService(
      source as never,
      categories as never,
      cases as never,
    );
  });

  it('lists outstanding with Overdue status when days_overdue set', async () => {
    source.query
      .mockResolvedValueOnce([{ cnt: 1 }])
      .mockResolvedValueOnce([
        {
          source_unitsale_id: 10,
          source_client_id: 2,
          client_name: 'X',
          cnic: null,
          mobile_number: null,
          email: null,
          source_unit_id: 1,
          unitname: '101',
          buildingname: 'A',
          source_project_id: 1,
          projectname: 'GOLDCREST',
          sale_number: 'BK-1',
          booking_date: '2021-01-01',
          net_price: 100,
          net_receipts: 10,
          current_outstanding: 90,
          sale_status_id: 4,
          next_due_date: null,
          oldest_overdue_due: '2024-01-01',
          days_overdue: 30,
        },
      ]);

    const result = await service.listOutstanding(superadmin, {
      page: 1,
      pageSize: 20,
    });
    expect(result.data[0].status).toBe('Overdue');
    expect(result.data[0].outstanding).toBe(90);
  });

  it('createRecoveryCase throws when sale has no outstanding', async () => {
    source.query.mockResolvedValueOnce([]);
    await expect(
      service.createRecoveryCase(superadmin, '999', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createRecoveryCase calls CasesService with Outstanding Query', async () => {
    source.query.mockResolvedValueOnce([
      {
        source_unitsale_id: 10,
        source_client_id: 2,
        source_unit_id: 5,
        client_name: 'X',
        sale_number: 'BK-1',
        unitname: '101',
        projectname: 'GOLDCREST',
        current_outstanding: 90,
      },
    ]);
    categories.findOne.mockResolvedValue({ id: '3', name: 'Outstanding Query' });
    cases.create.mockResolvedValue({ id: '99', caseNo: 'CS-1' });

    const created = await service.createRecoveryCase(superadmin, '10', {
      note: 'Follow up',
    });
    expect(cases.create).toHaveBeenCalledWith(
      superadmin,
      expect.objectContaining({
        categoryId: '3',
        sourceClientId: 2,
        sourceUnitsaleId: 10,
        sourceUnitId: 5,
        note: 'Follow up',
        priority: 'High',
      }),
    );
    expect(created.caseNo).toBe('CS-1');
  });
});
