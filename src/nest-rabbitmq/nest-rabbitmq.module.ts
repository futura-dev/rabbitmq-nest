import { DynamicModule, Module } from '@nestjs/common';
import * as amq from 'amqplib';
import { NestRabbitmqService } from './nest-rabbitmq.service';

type NestRabbitmqOptions = {
  RABBIT_USER: string;
  RABBIT_PASSWORD: string;
  RABBIT_HOST: string;
  RABBIT_PORT: string;
  RABBIT_QUEUE: string;
  rabbit_options?: amq.Options.AssertQueue;
  scope?: string;
  mode: 'subscribe' | 'publish';
};

@Module({})
export class NestRabbitmqModule {
  static configure(token: string, options: NestRabbitmqOptions): DynamicModule {
    const providers: DynamicModule['providers'] = [
      {
        provide: token,
        useFactory: () => {
          return new NestRabbitmqService(
            options.RABBIT_USER,
            options.RABBIT_PASSWORD,
            options.RABBIT_HOST,
            options.RABBIT_PORT,
            options.RABBIT_QUEUE,
            options.rabbit_options,
            options.mode,
            options.scope,
          );
        },
      },
    ];

    return {
      module: NestRabbitmqModule,
      exports: providers,
      providers: providers,
    };
  }
}
