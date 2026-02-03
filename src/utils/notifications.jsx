export const getNotificationType = (type) => {

  switch (type) {

    case 'FAMILY_POST_CREATED':

      return 'event';

    case 'FAMILY_GALLERY_CREATED':

      return 'event';

    case 'FAMILY_JOIN_REQUEST':

      return 'request';

    default:

      return 'event';

  }

};



export const getNotificationActions = (notification, handleJoinRequest) => {

  if (notification.type === 'FAMILY_JOIN_REQUEST') {

    return [

      {

        label: 'Approve',

        primary: true,

        onClick: () => handleJoinRequest(notification.referenceId, true),

      },

      {

        label: 'Reject',

        primary: false,

        onClick: () => handleJoinRequest(notification.referenceId, false),

      },

    ];

  }



  return null;

};

