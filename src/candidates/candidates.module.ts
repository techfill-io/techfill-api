import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'

import { CandidatesController } from './candidates.controller'
import { CandidatesService } from './candidates.service'

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [CandidatesController],
  providers: [CandidatesService],
})
export class CandidatesModule {}
