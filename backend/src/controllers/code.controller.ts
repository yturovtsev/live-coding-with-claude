import { Controller, Get, Post, Put, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CodeService } from '../services/code.service';

@Controller('api/code')
export class CodeController {
  constructor(private codeService: CodeService) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post()
  async createCodeFile() {
    try {
      const codeFile = await this.codeService.createCodeFile();
      return {
        id: codeFile.id,
        code: codeFile.code,
        language: codeFile.language,
        createdAt: codeFile.createdAt,
      };
    } catch (error) {
      throw new HttpException('Failed to create code file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  async getCodeFile(@Param('id') id: string) {
    try {
      const codeFile = await this.codeService.getCodeFile(id);
      if (!codeFile) {
        throw new HttpException('Code file not found', HttpStatus.NOT_FOUND);
      }

      if (new Date() > codeFile.expiresAt) {
        throw new HttpException('Code file has expired', HttpStatus.GONE);
      }

      return {
        id: codeFile.id,
        code: codeFile.code,
        language: codeFile.language,
        createdAt: codeFile.createdAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get code file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  async updateCodeFile(
    @Param('id') id: string,
    @Body() body: { code: string; language?: string },
  ) {
    try {
      const codeFile = await this.codeService.updateCodeFile(id, body.code, body.language);
      if (!codeFile) {
        throw new HttpException('Code file not found', HttpStatus.NOT_FOUND);
      }

      return {
        id: codeFile.id,
        code: codeFile.code,
        language: codeFile.language,
        createdAt: codeFile.createdAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to update code file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}