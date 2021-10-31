import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Controller('/auth/rabbitmq')
export class RabbitMqAuthController {
  constructor(private readonly users: UsersService) {}

  @Post('user')
  async authenticateUser(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    // allow access to all active users
    const user = await this.users.getUserByUsernameAndApiKey(
      username,
      password,
    );

    if (user && !user.disabled) {
      if (user.admin) {
        return 'allow administrator';
      }
      return 'allow';
    }
    return 'deny';
  }

  @Post('vhost')
  async authorizeVhost(
    @Body('username') username: string,
    @Body('vhost') vhost: string,
    @Body('ip') ip: string,
  ) {
    // allow access to the renderservice vhost all active users
    if (vhost === 'renderservice') {
      const user = await this.users.getUserByUsername(username);
      if (user && !user.disabled) {
        return 'allow';
      }
    }
    return 'deny';
  }

  @Post('resource')
  async authorizeResource(
    @Body('username') username: string,
    @Body('vhost') vhost: string,
    @Body('resource') resource: 'exchange' | 'queue' | 'topic',
    @Body('name') name: string,
    @Body('permission') permission: 'read' | 'write' | 'configure',
  ) {
    if (vhost !== 'renderservice') {
      return 'deny';
    }

    const user = await this.users.getUserByUsername(username);
    if (!user || user.disabled) {
      return 'deny';
    }

    // allow admins to do anything
    if (user.admin) return 'allow';

    // allow the system to create tasks
    if (
      permission === 'write' &&
      resource === 'queue' &&
      (name === 'rs_tasks' || name === 'rs_dumps' || name === 'rs_prepare')
    ) {
      return 'allow';
    }

    // allow anyone to read render and preprocessor tasks
    if (
      permission === 'read' &&
      resource === 'queue' &&
      (name === 'rs_tasks' || name === 'rs_prepare')
    ) {
      return 'allow';
    }

    return 'deny';
  }

  @Post('topic')
  authorizeTopic(
    @Body('username') username: string,
    @Body('vhost') vhost: string,
    @Body('resource') resource: 'topic',
    @Body('name') name: string,
    @Body('permission') permission: 'read' | 'write',
    @Body('routing_key') routingKey: string,
  ) {
    // we don't use topics
    return 'deny';
  }
}
