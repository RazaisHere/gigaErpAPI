import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource('workspace')
    private readonly workspace: DataSource,
    @InjectDataSource('source')
    private readonly source: DataSource,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Check workspace and source DB connections (SELECT 1)',
  })
  @ApiOkResponse({
    description: 'Connection status for both TypeORM connections',
  })
  async check() {
    const [workspaceOk, sourceOk] = await Promise.all([
      this.ping(this.workspace),
      this.ping(this.source),
    ]);

    return {
      status: workspaceOk && sourceOk ? 'ok' : 'degraded',
      timezone: process.env.TZ ?? 'Asia/Karachi',
      currency: 'PKR',
      connections: {
        workspace: { ok: workspaceOk },
        source: { ok: sourceOk },
      },
    };
  }

  @Get('probe')
  @ApiOperation({
    summary: 'Read-only probe: count rows in src_projects (live ERP view)',
  })
  @ApiOkResponse({
    description: 'src_projects row count via source connection',
  })
  async probe() {
    const rows = await this.source.query(
      'SELECT COUNT(*) AS count FROM src_projects',
    );
    const count = Number(rows[0]?.count ?? 0);

    return {
      view: 'src_projects',
      count,
      expected: 4,
      ok: count === 4,
      note: 'Read-only live link to gigagroup via src_* views',
    };
  }

  private async ping(ds: DataSource): Promise<boolean> {
    try {
      await ds.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
