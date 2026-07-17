import { PartialType } from '@nestjs/mapped-types';
import { CreateAiCornDto } from './create-ai-corn.dto';

export class UpdateAiCornDto extends PartialType(CreateAiCornDto) {}
