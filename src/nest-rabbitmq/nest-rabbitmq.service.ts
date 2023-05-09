import { Injectable, OnModuleInit, Scope } from '@nestjs/common';
import { Subject } from 'rxjs';
import { ConsumeMessage, Options } from 'amqplib';
import AssertQueue = Options.AssertQueue;
import * as amq from 'amqplib';

@Injectable({
  scope: Scope.TRANSIENT,
})
export class NestRabbitmqService<M> implements OnModuleInit {
  sender$ = new Subject<
    M extends { _scope: any; payload: any } ? M['payload'] : M
  >();
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

  constructor(
    RABBIT_USER: string,
    RABBIT_PASSWORD: string,
    RABBIT_HOST: string,
    RABBIT_PORT: string,
    RABBIT_QUEUE: string,
    options: AssertQueue,
    mode: 'publish' | 'subscribe',
    scope: string | undefined,
  ) {
    console.log('CREATED');
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
  }

  async onModuleInit(): Promise<void> {
    return new Promise((resolve) => {
      amq.connect(this.rabbitUri).then((connection) => {
        console.log(
          '[NEST_RABBIT_MODULE] configure',
          this.mode,
          'connection ok',
        );
        connection.createChannel().then((channel) => {
          console.log(
            '[NEST_RABBIT_MODULE] configure',
            this.mode,
            'channel ok',
          );
          channel
            .assertQueue(this.QUEUE, this.options ?? {})
            .then(async (queue_assertion) => {
              console.log(
                '[NEST_RABBIT_MODULE] configure',
                this.mode,
                'assertion ok',
                queue_assertion.queue,
              );
              console.log('CONNECTED TO RABBIT');
              resolve();
              // resolve({ ...options, mode: options.mode, channel: channel, queue_assertion: queue_assertion });
              // register listener
              if (this.mode === 'subscribe') {
                console.log(
                  '[NEST_RABBIT_SERVICE], OnModuleInit, ',
                  'subscribe mode',
                );
                await channel.consume(
                  this.QUEUE,
                  this.handleReceivedMessage.bind(this),
                  {
                    noAck: true,
                  },
                );
              }
              // register push function
              if (this.mode === 'publish') {
                console.log(
                  '[NEST_RABBIT_SERVICE], OnModuleInit, ',
                  'publish mode',
                );
                this.sender$.subscribe((data: any) => {
                  console.log(
                    '[RabbitService]: Sent %s ',
                    this.stringify(data),
                  );
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
    console.log('[RabbitService]: Received %s ', msg.content.toString());
    this.receiver$.next(JSON.parse(msg.content.toString()));
  }

  private stringify(message: any) {
    return JSON.stringify(message);
  }
}
