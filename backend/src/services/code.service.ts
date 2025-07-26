import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CodeFile } from '../models/code-file.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CodeService {
  constructor(
    @InjectModel(CodeFile)
    private codeFileModel: typeof CodeFile,
  ) {}

  async createCodeFile(): Promise<CodeFile> {
    return this.codeFileModel.create({
      id: uuidv4(),
      code: '',
      language: 'typescript',
    });
  }

  async getCodeFile(id: string): Promise<CodeFile | null> {
    return this.codeFileModel.findByPk(id);
  }

  async updateCodeFile(id: string, code: string, language?: string): Promise<CodeFile | null> {
    const codeFile = await this.codeFileModel.findByPk(id);
    if (!codeFile) return null;

    const updateData: any = { code };
    if (language) updateData.language = language;

    await codeFile.update(updateData);
    return codeFile;
  }

  async deleteExpiredFiles(): Promise<number> {
    const result = await this.codeFileModel.destroy({
      where: {
        expiresAt: {
          [require('sequelize').Op.lt]: new Date(),
        },
      },
    });
    return result;
  }
}
