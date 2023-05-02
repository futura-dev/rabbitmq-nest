import { DynamicModule, Module } from "@nestjs/common";
import { NestRabbitmqService } from "./nest-rabbitmq.service";
import { Tokens } from "../tokens";

@Module({})
export class NestRabbitmqModule {
  static forRoot(options: {
    mode: "subscribe" | "publish",
    RABBIT_USER: string,
    RABBIT_PASSWORD: string,
    RABBIT_HOST: string,
    RABBIT_PORT: string,
    RABBIT_QUEUE: string
  }): DynamicModule {

    const provider: DynamicModule["providers"] = [{
        provide: Tokens.RABBIT_SERVICE,
        useFactory: () => {
          return new NestRabbitmqService(options.RABBIT_USER, options.RABBIT_PASSWORD, options.RABBIT_HOST, options.RABBIT_PORT, options.RABBIT_QUEUE, options.mode);
        }
      }]
    ;

    return {
      providers: provider,
      exports: provider,
      module: NestRabbitmqModule
    };
  }
}
