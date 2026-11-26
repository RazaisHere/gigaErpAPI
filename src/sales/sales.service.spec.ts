import { NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  const source = { query: jest.fn() };
  const cases = { find: jest.fn() };
  let service: SalesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SalesService(source as never, cases as never);
  });

  it('lists sales with pagination meta', async () => {
    source.query
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([
        {
          source_unitsale_id: 3,
          source_client_id: 3,
          client_name: 'AYSHA',
          cnic: null,
          mobile_number: null,
          email: null,
          source_unit_id: 1,
          unitname: '3202',
          source_floor_id: null,
          floorname: null,
          source_building_id: 1,
          buildingname: 'TOWER-A',
          source_project_id: 1,
          projectname: 'GOLDCREST',
          sale_number: 'BK-1000003',
          booking_date: '2021-08-05',
          net_price: 100,
          net_receipts: 10,
          current_outstanding: 90,
          sale_status_id: 4,
        },
      ]);

    const result = await service.list({ page: 1, pageSize: 20 });
    expect(result.meta.total).toBe(2);
    expect(result.data[0].saleNumber).toBe('BK-1000003');
    expect(result.data[0].id).toBe('3');
  });

  it('throws when sale missing', async () => {
    source.query.mockResolvedValueOnce([]);
    await expect(service.findOne('999999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns sale 360 with owners and schedules', async () => {
    source.query
      .mockResolvedValueOnce([
        {
          source_unitsale_id: 3,
          source_client_id: 3,
          client_name: 'AYSHA',
          cnic: '1',
          mobile_number: '03',
          email: 'a@b.c',
          source_unit_id: 1,
          unitname: '3202',
          source_floor_id: 1,
          floorname: '32',
          source_building_id: 1,
          buildingname: 'TOWER-A',
          source_project_id: 1,
          projectname: 'GOLDCREST',
          sale_number: 'BK-1000003',
          booking_date: '2021-08-05',
          net_price: 100,
          net_receipts: 10,
          current_outstanding: 90,
          sale_status_id: 4,
        },
      ])
      .mockResolvedValueOnce([
        { id: 1, unitsale_id: 3, paymenttype_id: 1, due_date: '2022-01-01', percentage: 15 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    cases.find.mockResolvedValue([]);

    const detail = await service.findOne('3');
    expect(detail.owners).toHaveLength(1);
    expect(detail.installments).toHaveLength(1);
    expect(detail.unit.projectName).toBe('GOLDCREST');
  });
});
