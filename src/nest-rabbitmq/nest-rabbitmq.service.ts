import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";
import { Channel, ConsumeMessage } from "amqplib";
import * as amq from "amqplib";


@Injectable()
export class NestRabbitmqService {
  sender$ = new Subject<any>();
  private readonly RABBIT_USER;
  private readonly RABBIT_PASSWORD;
  private readonly RABBIT_HOST;
  private readonly RABBIT_PORT;
  private readonly QUEUE;
  private readonly rabbitUri;
  private channel: Channel;
  private readonly receiver$ = new Subject<any>();
  listener$ = this.receiver$.asObservable();

  constructor(RABBIT_USER: string, RABBIT_PASSWORD: string, RABBIT_HOST: string, RABBIT_PORT: string, RABBIT_QUEUE: string, mode: "publish" | "subscribe") {
    //
    this.RABBIT_USER = RABBIT_USER;
    this.RABBIT_PASSWORD = RABBIT_PASSWORD;
    this.RABBIT_HOST = RABBIT_HOST;
    this.RABBIT_PORT = RABBIT_PORT;
    this.QUEUE = RABBIT_QUEUE;
    this.rabbitUri = `amqp://${this.RABBIT_USER}:${this.RABBIT_PASSWORD}@${this.RABBIT_HOST}:${this.RABBIT_PORT}`;
    //
    amq.connect(this.rabbitUri).then((connection) => {
      connection.createChannel().then((channel) => {
        channel.assertQueue(this.QUEUE, { durable: false }).then(async (a) => {
          console.log("Connected to RabbitMQ queue: %s", a.queue);
          this.channel = channel;
          // register listener
          if (mode === "subscribe") {
            await this.channel.consume(
              this.QUEUE,
              this.handleReceivedMessage.bind(this),
              {
                noAck: true
              }
            );
          }
          // register push function
          if (mode === "publish") {
            this.sender$.subscribe((data: any) => {
              console.log("[RabbitService]: Sent %s ", this.stringify(data));
              this.channel.sendToQueue(
                this.QUEUE,
                Buffer.from(this.stringify(data))
              );
            });
          }
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
    console.log("[RabbitService]: Received %s ", msg.content.toString());
    this.receiver$.next(JSON.parse(msg.content.toString()));
  }

  private stringify(message: any) {
    return JSON.stringify(message);
  }
}
