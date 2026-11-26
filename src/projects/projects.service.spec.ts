import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  const source = { query: jest.fn() };
  let service: ProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectsService(source as never);
  });

  it('lists projects with counts', async () => {
    source.query.mockResolvedValueOnce([
      {
        id: 1,
        shortname: 'GC',
        projectname: 'GOLDCREST',
        area: 'DHA',
        city_id: 3,
        active: 1,
        building_count: 35,
        unit_count: 2996,
        sold_unit_count: 2000,
      },
    ]);

    const result = await service.list();
    expect(result.data[0].availableUnitCount).toBe(996);
    expect(result.data[0].projectName).toBe('GOLDCREST');
  });

  it('throws when project missing', async () => {
    source.query.mockResolvedValueOnce([]);
    await expect(service.findOne('99')).rejects.toBeInstanceOf(NotFoundException);
  });
});
