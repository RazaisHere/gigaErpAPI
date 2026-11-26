import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const source = { query: jest.fn() };
  let service: InventoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InventoryService(source as never);
  });

  it('maps Available/Sold inventory rows', async () => {
    source.query
      .mockResolvedValueOnce([{ cnt: 1 }])
      .mockResolvedValueOnce([
        {
          id: 1,
          unitname: '101',
          area: 100,
          gross_area: 110,
          price: 1000,
          active: 1,
          building_id: 1,
          buildingname: 'T-A',
          project_id: 1,
          projectname: 'GOLDCREST',
          unittype: 'Studio',
          floorname: '1',
          inventory_status: 'Sold',
        },
      ]);

    const result = await service.list({ status: 'Sold', page: 1, pageSize: 20 });
    expect(result.data[0].status).toBe('Sold');
    expect(result.data[0].projectName).toBe('GOLDCREST');
    expect(result.meta.total).toBe(1);
  });
});
