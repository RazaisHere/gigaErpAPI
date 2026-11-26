import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { ClientLink } from '../clients/entities/client-link.entity';

export type ApprovedClientLink = {
  linkId: string;
  sourceClientId: number;
  verificationStatus: string;
};

export async function resolveApprovedClientLink(
  links: Repository<ClientLink>,
  actor: RequestUser,
): Promise<ApprovedClientLink> {
  if (actor.roleCode !== 'client') {
    throw new ForbiddenException('Client role required');
  }

  const link = await links.findOne({
    where: { user: { id: actor.id } },
  });

  if (!link) {
    throw new ForbiddenException('No client link for this account');
  }
  if (link.verificationStatus !== 'approved') {
    throw new ForbiddenException(
      `Client link is ${link.verificationStatus}; approved verification required`,
    );
  }

  return {
    linkId: String(link.id),
    sourceClientId: link.sourceClientId,
    verificationStatus: link.verificationStatus,
  };
}
