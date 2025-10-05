import { ForbiddenException } from '@nestjs/common';

export class VoterException extends ForbiddenException {
  constructor(message: string = 'Access denied') {
    super(message);
  }
}
