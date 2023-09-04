import { Injectable, Logger, OnModuleInit, Scope } from "@nestjs/common";
import { Subject } from 'rxjs';
import { ConsumeMessage, Options } from 'amqplib';
import AssertQueue = Options.AssertQueue;
import * as amq from 'amqplib';
import { SubscriberStrategy } from "./nest-rabbitmq.module";

@Injectable({
  scope: Scope.TRANSIENT,
})
export class NestRabbitmqService<M> implements OnModuleInit {
  sender$ = new Subject<
    M extends { _scope: any; payload: any } ? M['payload'] : M
  >();
  logger = new Logger(NestRabbitmqService.name);
  private readonly RABBIT_USER;
  private readonly RABBIT_PASSWORD;
  private readonly RABBIT_HOST;
  private readonly RABBIT_PORT;
  private readonly QUEUE;
  private readonly rabbitUri;
  private readonly scope;
  private readonly receiver$ = new Subject<
    M extends { _scope: any; payload: any } ? M['payload'] : M
  >();
  listener$ = this.receiver$.asObservable();
  private readonly mode: 'subscribe' | 'publish';
  private readonly options: AssertQueue;
  private readonly strategy: SubscriberStrategy | null;

  constructor(
    RABBIT_USER: string,
    RABBIT_PASSWORD: string,
    RABBIT_HOST: string,
    RABBIT_PORT: string,
    RABBIT_QUEUE: string,
    options: AssertQueue,
    mode: 'publish' | 'subscribe',
    scope: string | undefined,
    strategy: SubscriberStrategy | null
  ) {
    //
    this.RABBIT_USER = RABBIT_USER;
    this.RABBIT_PASSWORD = RABBIT_PASSWORD;
    this.RABBIT_HOST = RABBIT_HOST;
    this.RABBIT_PORT = RABBIT_PORT;
    this.QUEUE = RABBIT_QUEUE;
    this.rabbitUri = `amqp://${this.RABBIT_USER}:${this.RABBIT_PASSWORD}@${this.RABBIT_HOST}:${this.RABBIT_PORT}`;
    this.scope = scope;
    this.mode = mode;
    this.options = options;
    this.strategy = strategy;
  }

  async onModuleInit(): Promise<void> {
    return new Promise((resolve) => {
      amq.connect(this.rabbitUri).then((connection) => {

        connection.createChannel().then((channel) => {
          channel
            .assertQueue(this.QUEUE, this.options ?? {})
            .then(async (queue_assertion) => {
              this.logger.log(`connected in "${this.mode}" mode to ${this.rabbitUri}`);
              this.logger.log(`configured "${queue_assertion.queue}"`);
              resolve();
              // resolve({ ...options, mode: options.mode, channel: channel, queue_assertion: queue_assertion });
              // register listener
              if (this.mode === 'subscribe') {
                if (this.strategy && this.strategy.mode === 'all') {
                  await channel.consume(
                    this.QUEUE,
                    this.handleReceivedMessage.bind(this),
                    {
                      noAck: true,
                    },
                  );
                } else {
                  if (this.strategy.mode === 'one-by-one') {
                    setInterval(() => {
                      channel.get(this.QUEUE, { noAck: true })
                        .then(message  => {
                          if (message) {
                            this.handleReceivedMessage({
                              content: message.content,
                              fields: {
                                consumerTag: '',
                                ...message.fields
                              },
                              properties: message.properties
                            })
                          }
                        })
                    }, this.strategy.delay)
                  }
                }
              }
              // register push function
              if (this.mode === 'publish') {
                this.sender$.subscribe((data: any) => {
                  this.logger.debug(`Sent: ${this.stringify(data)}`)
                  const message = this.scope
                    ? { _scope: this.scope, payload: data }
                    : data;
                  channel.sendToQueue(
                    this.QUEUE,
                    Buffer.from(this.stringify(message)),
                  );
                });
              }
            });
        });
      });
    });
  }

  /**
   * Push received message to the stream
   * @param {ConsumeMessage} msg
   * @return {void}
   */
  private handleReceivedMessage(msg: ConsumeMessage): void {
    this.logger.debug(`Received: ${msg.content.toString()}`)
    this.receiver$.next(JSON.parse(msg.content.toString()));
  }

  private stringify(message: any) {
    return JSON.stringify(message);
  }
}
