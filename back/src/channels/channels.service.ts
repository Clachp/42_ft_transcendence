import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateChannelDto, UpdateChannelDto, AuthChannelDto } from './dto/';
import { Channel, User, ChannelStatus, Role, Prisma } from '@prisma/client';
import * as argon from 'argon2';
import { JwtGuard } from 'src/auth/guards/auth.guard';

@UseGuards(JwtGuard)
@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  //retrieve all public channels
  async findAllChannels() {
    const publicChannels = await this.prisma.channel.findMany({
      where: { type: {
        in: ['PUBLIC', 'PROTECTED']
      }
    },
    })
    if (publicChannels)
      console.log("YES");
    return publicChannels;
  }

  async findOneChannel(chanId: number) {
    const channelDatas = await this.prisma.channel.findUnique({ 
      where: { 
        id: chanId
      },
      include: {
        members: {
          select: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                status: true,
                wins: true,
                draws: true,
                losses : true     
              }
            },
            role: true
          }
        }
      }
    })
    if (!channelDatas)
      throw new NotFoundException(`Channel with id ${chanId} not found`);

    const channel = {
      ...channelDatas,
      messages: [], // en attendant de pouvoir recup les messages
      users: channelDatas.members.map((member) => {
        if (member.role === "USER")
          return (member.user)
      }).filter(Boolean),
      administrators: channelDatas.members.map((member) => {
        if (member.role === "ADMIN")
          return (member.user)
      }).filter(Boolean),
      owner: channelDatas.members.find((member) => member.role === "OWNER").user,
      mutedUsers: [], // en attendant de pouvoir recup les users mutes
      bannedUsers: [] // en attendant de pouvoir recup les users bans
    }

    delete channel.members

    return channel;
  }

  async createChannel(createChannelDto: CreateChannelDto, creator: User) {
    console.log("creator :", creator);
    const newChannel = await this.prisma.channel.create({
      data: {
        name: createChannelDto.name,
        avatar: createChannelDto.avatar,
        type: createChannelDto.type,
        members: { 
          create: [
            {
              role: 'OWNER',
              user: {connect: { id: creator.id }}
            }
          ]  
        },
      }
    })
    // setting password
    if (newChannel.type === ChannelStatus.PRIVATE || newChannel.type === ChannelStatus.PROTECTED )
    {
      await this.prisma.channel.update({ where: { id: newChannel.id },
        data: { password: await argon.hash(createChannelDto.password) } 
      })
    }
    return newChannel;
  }

  async findChannel(chanId: number) {
    const channel = await this.prisma.channel.findUnique({where: { id: chanId }},)
    if (!channel)
      throw new NotFoundException(`Channel id ${chanId} not found`);
    return channel;
  }


  async isInChannel(userId: number, chanId: number) {
    
    const inChannel = await this.prisma.usersOnChannels.findUnique({
      where: {
       userId_channelId: {
        userId: userId,
        channelId: chanId
      }
    }});

  return inChannel;
}

  async joinChannel(dto: AuthChannelDto, user: User) {
    try {
      const chan = await this.findChannel(dto.id);
      
      const inChan = await this.isInChannel(user.id, chan.id);
      if (inChan)
        throw new BadRequestException(`User ${user.id} is already in channel ${chan.id}`);

      if (chan.password) {
        const pwdMatch = await argon.verify(chan.password, dto.password);
			if (!pwdMatch)
				throw new ForbiddenException('incorrect password');
      }

      const joinChannel = await this.prisma.channel.update({ where: { id: chan.id}, 
        data: {
          members: { 
            create: [
              {
                role: 'USER',
                user: {connect: { id: user.id }}
              }
            ]  
          }
        }})
      return joinChannel;

    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError)
        return { error: 'An error occurred while addind other user in channel' };
      throw error;
    }
  }

  async addUserInChannel(friendId: number, member: User, chanId: number) {
    if (friendId === member.id)
      return { error: 'Cannot add your self in channel'}

    try {
      this.findChannel(chanId);
      
      if (await this.isInChannel(friendId, chanId))
        throw new NotFoundException(`User ${friendId} is already in channel ${chanId}`);

      const userInchannel = await this.isInChannel(member.id, chanId);
      if (!userInchannel)
        throw new NotFoundException(`User id ${member.id} is not in channel id ${chanId}`);
      
        if (userInchannel.role ===  Role.USER || !userInchannel.role)
          throw new ForbiddenException(`User ${member.id} has not required role for this action`);
      
        const addInChannel = await this.prisma.channel.update({ where: { id: chanId}, 
        data: {
          members: {
            connect: [{ userId_channelId: { userId: friendId, channelId: chanId }}],
            create: [{ userId: friendId, role: Role.USER }]
          }
        }})
        return addInChannel;
    } catch (error) { 
      if (error instanceof Prisma.PrismaClientKnownRequestError)
				return { error: 'An error occurred while addind other user in channel' };
			throw error;
    }   
  }

  async updateChannel(chanId: number, dto: UpdateChannelDto, user: User) {
    try {
      const chan = await this.findChannel(chanId);
      const inChan = await this.isInChannel(user.id, chan.id)
      if (!inChan)
        throw new NotFoundException(`User ${user.id} is not in channel ${chan.id}`);
      if (chan.password) {
        const pwdMatch = await argon.verify(chan.password, dto.password);
			if (!pwdMatch)
				throw new ForbiddenException('incorrect password');
      }
      if (inChan.role !== Role.OWNER || !inChan.role)
        throw new ForbiddenException(`User ${user.id} has not required role for this action`);
      
        const updateChannel = await this.prisma.channel.update({ where: { id: chan.id}, 
        data: {
          name: dto.name,
	        type: dto.type,
	        password:	dto.password,
          avatar: dto.avatar
        }})
      return updateChannel;

    } catch (error) { }    
  }

  async countMembersInChannel(chanId: number): Promise<number> {

    const result = (await this.prisma.channel.findUnique({
      where: {
        id: chanId
      },
      include: {
        members: true
      }
    })).members.length

    return (result)
  }

  async setNewOwner(chanId: number) {
    
    const administratorFound = await this.prisma.usersOnChannels.findFirst({
      where: {
        channelId: chanId,
        role: "ADMIN"
      },
      select: {
        userId: true,
        role: true
      }
    })
    const memberFound = await this.prisma.usersOnChannels.findFirst({
      where: {
        channelId: chanId,
        role: "USER"
      },
      select: {
        userId: true,
        role: true
      }
    })

    const newOwner = administratorFound ? administratorFound : memberFound

    await this.prisma.usersOnChannels.update({
      where: {
        userId_channelId: {
          userId: newOwner.userId,
          channelId: chanId
        }
      },
      data: {
        role: "OWNER"
      },
      select: {
        userId: true,
        role: true
      }
    })
  }

  async leaveChannel(user: User, chanId: number) {

    const userLeave = await this.prisma.usersOnChannels.delete({
      where: {
        userId_channelId: {
          userId: user.id,
          channelId: chanId
        }
      }
    })

    const numberOfMembers: number = await this.countMembersInChannel(chanId)

    if (numberOfMembers === 0)
    {
      const removeChannel = await this.remove(chanId)
      return ([ userLeave, removeChannel ])
    }
    else if (userLeave.role === "OWNER")
    {
      const newOwner = await this.setNewOwner(chanId)
      return ([ userLeave, newOwner ])
    }
    return (userLeave)
  }

  async remove(id: number) {
  
    await this.prisma.usersOnChannels.deleteMany({
      where: {
        channelId: id
      }
    })

		const deleteChannel = await this.prisma.channel.delete({
      where: {
        id: id
      }
    });
		return deleteChannel;
	}


  /****************************** CRUD USER ON CHANNEL ***********************/



  // ROLE USER : BLOCK, INVITE_PONG, GET_PROFILE, LEAVE, SEND_MESSAGE

  // ROLE ADMIN : BLOCK, LEAVE, KICK, BAN, MUTE /!\ if target is not owner

  // ROLE OWNER : SET_PASSWORD, SET_ADMINS


}
