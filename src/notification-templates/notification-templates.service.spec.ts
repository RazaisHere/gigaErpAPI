import { NotificationTemplatesService } from './notification-templates.service';

describe('NotificationTemplatesService', () => {
  const templates = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: '1', ...x })),
  };
  let service: NotificationTemplatesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationTemplatesService(templates as never);
  });

  it('previews placeholders', async () => {
    templates.findOne.mockResolvedValue({
      id: '1',
      name: 'Case opened',
      templateKey: 'case_opened',
      channel: 'Email',
      subject: 'Case {case_no} opened',
      body: 'Dear {client_name}, your case {case_no} has been opened.',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const preview = await service.preview('1', {
      clientName: 'Ali',
      caseNo: 'CS-9',
    });
    expect(preview.subject).toBe('Case CS-9 opened');
    expect(preview.body).toContain('Dear Ali');
    expect(preview.body).toContain('CS-9');
  });
});
