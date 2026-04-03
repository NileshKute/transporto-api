import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BpclCardService {
  constructor(private prisma: PrismaService) {}

  async getAllCards() {
    const cards = await this.prisma.bpclCard.findMany({
      include: {
        periods: { orderBy: { startDate: 'asc' } },
      },
      orderBy: { cardNumber: 'asc' },
    });

    const result = [];
    for (const card of cards) {
      const stats = await this.prisma.bpclTransaction.aggregate({
        where: { cardNumber: card.cardNumber },
        _sum: { litres: true, totalAmount: true },
      });
      const txnCount = await this.prisma.bpclTransaction.count({
        where: { cardNumber: card.cardNumber },
      });
      result.push({
        ...card,
        txnCount,
        totalLitres: stats._sum.litres ?? 0,
        totalAmount: stats._sum.totalAmount ?? 0,
      });
    }
    return result;
  }

  async getCard(id: string) {
    const card = await this.prisma.bpclCard.findUnique({
      where: { id },
      include: { periods: { orderBy: { startDate: 'asc' } } },
    });
    if (!card) throw new NotFoundException('Card not found');

    const stats = await this.prisma.bpclTransaction.aggregate({
      where: { cardNumber: card.cardNumber },
      _sum: { litres: true, totalAmount: true },
    });
    const txnCount = await this.prisma.bpclTransaction.count({
      where: { cardNumber: card.cardNumber },
    });

    const periodStats = [];
    for (const period of card.periods) {
      const periodWhere = {
        cardNumber: card.cardNumber,
        txnDate: {
          gte: period.startDate,
          ...(period.endDate ? { lte: period.endDate } : {}),
        },
      };
      const pStats = await this.prisma.bpclTransaction.aggregate({
        where: periodWhere,
        _sum: { litres: true, totalAmount: true },
      });
      const pCount = await this.prisma.bpclTransaction.count({
        where: periodWhere,
      });
      periodStats.push({
        ...period,
        txnCount: pCount,
        totalLitres: pStats._sum.litres ?? 0,
        totalAmount: pStats._sum.totalAmount ?? 0,
      });
    }

    return {
      ...card,
      txnCount,
      totalLitres: stats._sum.litres ?? 0,
      totalAmount: stats._sum.totalAmount ?? 0,
      periodStats,
    };
  }

  async updateCard(
    id: string,
    data: { currentTag?: string; notes?: string },
  ) {
    return this.prisma.bpclCard.update({
      where: { id },
      data: {
        ...(data.currentTag != null ? { currentTag: data.currentTag } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
  }

  async addPeriod(
    cardId: string,
    data: { tag: string; startDate: string; endDate?: string; notes?: string },
  ) {
    const start = new Date(data.startDate);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }

    const endPrev = new Date(start);
    endPrev.setUTCDate(endPrev.getUTCDate() - 1);
    endPrev.setUTCHours(23, 59, 59, 999);

    await this.prisma.bpclCardPeriod.updateMany({
      where: { cardId, endDate: null },
      data: { endDate: endPrev },
    });

    const period = await this.prisma.bpclCardPeriod.create({
      data: {
        cardId,
        tag: data.tag,
        startDate: start,
        endDate: data.endDate ? new Date(data.endDate) : null,
        notes: data.notes || null,
      },
    });

    await this.prisma.bpclCard.update({
      where: { id: cardId },
      data: { currentTag: data.tag },
    });

    return period;
  }

  async updatePeriod(
    periodId: string,
    data: {
      tag?: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
    },
  ) {
    const update: Record<string, unknown> = {};
    if (data.tag) update.tag = data.tag;
    if (data.startDate) update.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) {
      update.endDate = data.endDate ? new Date(data.endDate) : null;
    }
    if (data.notes !== undefined) update.notes = data.notes;
    return this.prisma.bpclCardPeriod.update({
      where: { id: periodId },
      data: update,
    });
  }

  async deletePeriod(periodId: string) {
    return this.prisma.bpclCardPeriod.delete({ where: { id: periodId } });
  }

  async bulkUpdateTags(updates: Array<{ cardNumber: string; tag: string }>) {
    const results: Array<{
      cardNumber: string;
      tag: string;
      status: string;
    }> = [];
    for (const u of updates) {
      const card = await this.prisma.bpclCard.findUnique({
        where: { cardNumber: u.cardNumber },
      });
      if (card) {
        await this.prisma.bpclCard.update({
          where: { id: card.id },
          data: { currentTag: u.tag },
        });
        results.push({
          cardNumber: u.cardNumber,
          tag: u.tag,
          status: 'updated',
        });
      } else {
        results.push({
          cardNumber: u.cardNumber,
          tag: u.tag,
          status: 'not_found',
        });
      }
    }
    return results;
  }

  async getTagForTransaction(cardNumber: string, txnDate: Date): Promise<string> {
    const card = await this.prisma.bpclCard.findUnique({
      where: { cardNumber },
      include: { periods: { orderBy: { startDate: 'desc' } } },
    });
    if (!card) return 'UNTAGGED';

    for (const period of card.periods) {
      const afterStart = txnDate >= period.startDate;
      const beforeEnd =
        !period.endDate || txnDate <= period.endDate;
      if (afterStart && beforeEnd) return period.tag;
    }

    return card.currentTag;
  }
}
