New ec2 Address:
http://ec2-13-48-72-129.eu-north-1.compute.amazonaws.com:8081

https://api.gajkesaristeels.in
USER LOGIN
Register New User
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/register
PayLoad:
{
    "username":"SalesAdmin",
    "password":"Sales123",
    "roles":"ADMIN"
}
Response:
ADMIN eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IlNhbGVzQWRtaW4iLCJyb2xlcyI6IkFETUlOIiwiaWF0IjoxNzEwNDU2MTAwLCJleHAiOjE3MTA0NjgxMDB9.CsxtiDXRfGg1Y7EolQ3IwP933Whj7ougXm9BtD2-K9MIJgaDhJeZTPMLsfjgg53D6F8kapHPsL2AFF5WXN1HcA

{
    "username":"OfficeManager",
    "password":"Officemanager123",
    "roles":"OFFICE MANAGER"
}

Login
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/token

PayLoad:
{
   "username":"SalesAdmin",
    "password":"Sales123"
}
Response:
ADMIN eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IlNhbGVzQWRtaW4iLCJyb2xlcyI6IkFETUlOIiwiaWF0IjoxNzEwNDU2NDc2LCJleHAiOjE3MTA0Njg0NzZ9.6Qlt3Go2N7eaZhPc5ZMaeZQTv1p9ajbD4Bye8z6Fs9Z2Xx1M6l2WVH0daSWRlspBkHtDUqdvhZka8FiqW0BB7A
Logout
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/logout
Success Response:
Successfully logged out

TASK CONFIG
Create task type
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task-type/create
Response:
1
Edit task type
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task-type/edit?id=1&type=birthdays
PayLoad:
Response:

Delete task type
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task-type/delete?id=1
Response:
Object Deletd!
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task-type/getAll
Response:
[
    {
        "id": 2,
        "type": "birthday"
    }
]

Get By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task-type/getById?id=2
Response:
{
    "id": 2,
    "type": "birthday"
}

Error Response:
Error Fetching Task type: Type Not Found!

TASK
Create task For Store
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/create
PayLoad:
{
    "taskDesciption":"call",
    "dueDate":"2024-03-11",
    "assignedToId":1,
    "assignedById":2,
"storeId": 1,
"taskType": "birthday",
    "status":"Assigned",
    "priority":"low"
}	
Response:
1
Create Task For A Visit
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/create
Payload:
{
    "taskDesciption":"call",
    "dueDate":"2024-06-30",
    "assignedToId":33,
    "assignedById":97,
    "storeId": 33,
    "taskType": "requirement",
    "status":"Assigned",
    "priority":"low",
    "visitId":2057
}




Get By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getById?id=1
Response:
{
    "id": 1,
    "taskTitle": "title 1",
    "taskDesciption": "call",
    "taskType": "birthday",
    "dueDate": "2024-03-11",
    "assignedToId": 2,
    "assignedToName": "Shubham T",
    "assignedById": 1,
    "assignedByName": "Shilpa K",
    "storeId": 1,
    "storeName": "store1",
    "storeCity": "Mumbai",
    "status": "Assigned",
    "priority": "low",
    "attachment": [],
    "attachmentResponse": [
        {
            "fileName": "Code.JPG",
            "fileDownloadUri": "http://localhost:8081/downloadFile/Code.JPG",
            "fileType": "image/jpeg",
            "tag": "check-in",
            "size": 0
        }
    ],
    "createdAt": "2024-06-15",
    "updatedAt": "2024-06-16",
    "createdTime": "21:06:46.956",
    "updatedTime": "16:57:41.203"
}
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getAll
Response:
[
     {
        "id": 65,
        "taskTitle": "asd",
        "taskDesciption": "asd",
        "taskType": "complaint",
        "dueDate": "2024-07-03",
        "assignedToId": 33,
        "assignedToName": "Yash Puri",
        "assignedById": null,
        "assignedByName": null,
        "storeId": 17,
        "storeName": "Jasraj",
        "storeCity": "Jalna ",
        "visitId": 2440,
        "visitDate": "2024-07-03",
        "imageCount": 2,
        "status": "Assigned",
        "priority": "Medium",
        "attachment": [],
        "attachmentResponse": [],
        "createdAt": "2024-07-03",
        "updatedAt": "2024-07-03",
        "createdTime": "12:52:58.867",
        "updatedTime": "14:26:09.859"
    }
]
Get By Assigned To And Date Range
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByAssignedToAndDate?id=2&start=2024-02-01&end=2024-06-11
Response:
[
    {
        "id": 1,
        "taskTitle": "title 1",
        "taskDesciption": "call",
        "taskType": "birthday",
        "dueDate": "2024-03-11",
        "assignedToId": 2,
        "assignedToName": "Shubham T",
        "assignedById": 1,
        "assignedByName": "Shilpa K",
        "storeId": 1,
        "storeName": "store1",
        "storeCity": "Mumbai",
        "status": "Assigned",
        "priority": "low",
        "createdAt": "2024-06-15",
        "updatedAt": "2024-06-16",
        "createdTime": "21:06:46.956",
        "updatedTime": "16:57:41.203"
    }
]
Get By Assigned To
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByAssignedTo?id=2
Response:
[
    {
        "id": 1,
        "taskTitle": "title 1",
        "taskDesciption": "call",
        "taskType": "birthday",
        "dueDate": "2024-03-11",
        "assignedToId": 2,
        "assignedToName": "Shubham T",
        "assignedById": 1,
        "assignedByName": "Shilpa K",
        "storeId": 1,
        "storeName": "store1",
        "storeCity": "Mumbai",
        "status": "Assigned",
        "priority": "low",
        "createdAt": "2024-06-15",
        "updatedAt": "2024-06-16",
        "createdTime": "21:06:46.956",
        "updatedTime": "16:57:41.203"
    }
]
Get By Assigned By
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByAssignedBy?id=1
Response:
[
    {
        "id": 1,
        "taskTitle": "title 1",
        "taskDesciption": "call",
        "taskType": "birthday",
        "dueDate": "2024-03-11",
        "assignedToId": 2,
        "assignedToName": "Shubham T",
        "assignedById": 1,
        "assignedByName": "Shilpa K",
        "storeId": 1,
        "storeName": "store1",
        "storeCity": "Mumbai",
        "status": "Assigned",
        "priority": "low",
        "createdAt": "2024-06-15",
        "updatedAt": "2024-06-16",
        "createdTime": "21:06:46.956",
        "updatedTime": "16:57:41.203"
    },
    {
        "id": 2,
        "taskTitle": "title 2",
        "taskDesciption": "call",
        "taskType": "purchase",
        "dueDate": "2024-03-11",
        "assignedToId": 2,
        "assignedToName": "Shubham T",
        "assignedById": 1,
        "assignedByName": "Shilpa K",
        "storeId": 5,
        "storeName": "store3",
        "storeCity": "Mumbai",
        "status": "Assigned",
        "priority": "low",
        "createdAt": "2024-06-15",
        "updatedAt": "2024-06-16",
        "createdTime": "21:07:05.675",
        "updatedTime": "17:29:18.521"
    }
]
Get By Due Date
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByDueDate?dueDate=2024-03-11
Response:
[
    {
        "id": 1,
        "taskTitle": "title 1",
        "taskDesciption": "call",
        "taskType": "birthday",
        "dueDate": "2024-03-11",
        "assignedToId": 2,
        "assignedToName": "Shubham T",
        "assignedById": 1,
        "assignedByName": "Shilpa K",
        "storeId": 1,
        "storeName": "store1",
        "storeCity": "Mumbai",
        "status": "Assigned",
        "priority": "low",
        "createdAt": "2024-06-15",
        "updatedAt": "2024-06-16",
        "createdTime": "21:06:46.956",
        "updatedTime": "16:57:41.203"
    }
]
Get By Due Date and priority
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByPriorityAndDue?dueDate=2024-03-11&priority=high
Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/deleteById?taskId=1

Response:
Task deleted!
Error Response:
Error Deleting Task: Task Not Found!
Add Attachment
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/uploadFile?id=1&tag=check-in
PayLoad:
File
Response:
{
    "fileName": "Code.JPG",
    "fileDownloadUri": "http://localhost:8081/downloadFile/Code.JPG",
    "fileType": "image/jpeg",
    "tag": "check-in",
    "size": 68773
}
Remove Attachment
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/removeFile?id=1
PayLoad:
{
    "ids":[
        1
    ]
}
Response:
Attachments deleted successfully from the task.

Download Attachment
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/downloadFile/1/check-in/Code.JPG


Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/updateTask?taskId=1
PayLoad:
{
    "status":"Work In Progress",
    "priority":"Medium"
}
Response:
{
    "id": 1,
    "taskDesciption": "call",
    "dueDate": "2024-03-11",
    "assignedToId": 1,
    "assignedToName": "Shilpa K",
    "assignedById": 1,
    "assignedByName": "Shilpa K",
    "status": null,
    "priority": null,
    "createdAt": "2024-03-10",
    "updatedAt": "2024-03-10",
    "createdTime": null,
    "updatedTime": null
}


Get By Visit
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByVisit?type=requirement&visitId=2057
Response:
[
    {
        "id": 23,
        "taskTitle": null,
        "taskDesciption": "call",
        "taskType": "requirement",
        "dueDate": "2024-06-30",
        "assignedToId": 33,
        "assignedToName": "Yash Puri",
        "assignedById": 97,
        "assignedByName": "Sarthak S",
        "storeId": 33,
        "storeName": "SM traders",
        "storeCity": "Jalna",
        "visitId": 2057,
        "visitDate": "2024-06-25",
        "status": "Assigned",
        "priority": "low",
        "attachment": [],
        "attachmentResponse": [],
        "createdAt": "2024-06-29",
        "updatedAt": "2024-06-29",
        "createdTime": "22:36:42.02",
        "updatedTime": "22:36:42.02"
    }
]
Get By Date Range
Get Call
http://localhost:8081/task/getByDate?start=2024-04-01&end=2024-07-10
Response:
[
    {
        "id": 1,
        "taskTitle": "title 1",
        "taskDesciption": "call",
        "taskType": "birthday",
        "dueDate": "2024-03-11",
        "assignedToId": 2,
        "assignedToName": "Shubham T",
        "assignedById": 1,
        "assignedByName": "Shilpa K",
        "storeId": 1,
        "storeName": "store1",
        "storeCity": "Mumbai",
        "visitId": null,
        "visitDate": null,
        "status": "Assigned",
        "priority": "low",
        "attachment": [],
        "attachmentResponse": [],
        "createdAt": "2024-06-15",
        "updatedAt": "2024-06-16",
        "createdTime": "21:06:46.956",
        "updatedTime": "16:57:41.203"
    }
]
Get By Date Range For Team
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByTeamAndDate?start=2024-03-01&end=2024-07-10&id=1

Get For a Store And Date range
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByStoreAndDate?storeId=17&start=2024-06-01&end=2024-06-30
Response:
[
    {
        "id": 6,
        "taskTitle": null,
        "taskDesciption": "call",
        "taskType": "birthday",
        "dueDate": "2024-06-19",
        "assignedToId": 33,
        "assignedToName": "Yash Puri",
        "assignedById": 86,
        "assignedByName": "Test 1",
        "storeId": 17,
        "storeName": "Jasraj",
        "storeCity": "Jalna ",
        "visitId": null,
        "visitDate": null,
        "status": "Assigned",
        "priority": "High",
        "attachment": [],
        "attachmentResponse": [],
        "createdAt": "2024-06-20",
        "updatedAt": "2024-06-20",
        "createdTime": "18:12:47.522",
        "updatedTime": "19:59:13.014"
    },
    {
        "id": 31,
        "taskTitle": "Tesst",
        "taskDesciption": "sdfsdfs",
        "taskType": "complaint",
        "dueDate": "2024-06-30",
        "assignedToId": 33,
        "assignedToName": "Yash Puri",
        "assignedById": 33,
        "assignedByName": "Yash Puri",
        "storeId": 17,
        "storeName": "Jasraj",
        "storeCity": "Jalna ",
        "visitId": null,
        "visitDate": null,
        "status": "Assigned",
        "priority": "low",
        "attachment": [],
        "attachmentResponse": [],
        "createdAt": "2024-07-01",
        "updatedAt": "2024-07-01",
        "createdTime": "02:57:06.787",
        "updatedTime": "02:57:06.787"
    },
    {
        "id": 32,
        "taskTitle": "Tesst",
        "taskDesciption": "sdfsdfs",
        "taskType": "complaint",
        "dueDate": "2024-06-30",
        "assignedToId": 33,
        "assignedToName": "Yash Puri",
        "assignedById": 33,
        "assignedByName": "Yash Puri",
        "storeId": 17,
        "storeName": "Jasraj",
        "storeCity": "Jalna ",
        "visitId": null,
        "visitDate": null,
        "status": "Assigned",
        "priority": "low",
        "attachment": [],
        "attachmentResponse": [],
        "createdAt": "2024-07-01",
        "updatedAt": "2024-07-01",
        "createdTime": "02:58:06.853",
        "updatedTime": "02:58:06.853"
    }
]
Get By Team
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/task/getByTeam?id=1
Response:
[
    {
        "id": 1,
        "taskTitle": "title 1",
        "taskDesciption": "call",
        "taskType": "birthday",
        "dueDate": "2024-03-11",
        "assignedToId": 2,
        "assignedToName": "Shubham T",
        "assignedById": 1,
        "assignedByName": "Shilpa K",
        "storeId": 1,
        "storeName": "store1",
        "storeCity": "Mumbai",
        "status": "Assigned",
        "priority": "low",
        "createdAt": "2024-06-15",
        "updatedAt": "2024-06-16",
        "createdTime": "21:06:46.956",
        "updatedTime": "16:57:41.203"
    }
]
 
Sites
Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/site/add
PayLoad:
{
    "siteName":"Site 1",
    "startDate":"2024-06-08",
    "endDate":"2024-07-16",
    "Status":"active",
    "addressLine1": "Street 1",
    "addressLine2": "Opp Main Road",
    "requirement":100,
    "city":"Mumbai",
    "storeId":1,
    "completed":10.2,
    "brandsInUse":["A","B"]


}
Response:
1

Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/site/edit?id=1
PayLoad:
{
    "siteName":"Site 1",
    "startDate":"2024-06-08",
    "endDate":"2024-07-16",
    "status":"active",
    "requirement":100,
    "city":"Mumbai",
    "storeId":1,
    "addressLine1": "Street 1",
    "addressLine2": "Opp Main Road",
    "completed":10.2




}
Response:
1

Add Brands In Use
Put Call
http:/ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/site/addBrands?id=2
PayLoad:
{
    "brands":["A", "B", "C"]
}
Response:
Brands updated!

Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/site/getAll
Response:
[
    {
        "id": 2,
        "storeId": 1,
        "storeName": "store1",
        "siteName": "Site 1",
        "city": "Mumbai",
        "state": null,
        "addressLine1": "Street 1",
        "addressLine2": "Opp Main Road",
        "startDate": "2024-06-08",
        "endDate": "2024-07-16",
        "status": "active",
        "completionStatus": null,
        "brandsInUse": [
            "A",
            "B",
            "C"
        ],
        "requirement": 100.0,
        "completed": 10.2,
        "createdAt": "2024-11-06",
        "createdTime": "17:44:21.557",
        "updatedAt": "2024-11-06",
        "updatedTime": "18:02:36.264"
    }
]


Remove Brands
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/site/removeBrands?id=2
PayLoad:
{
    "brands":["B"]
}
Response:
Brands removed!

Mark Completion Status
Put Call
http://localhost:8081/site/markCompletionStatus?id=2&status=true
Response:
Status Updated!


 Delete
Delete call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/site/delete?id=1
Response:
Deleted successfully!
Get By Store
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/site/getByStore?id=1
Response:
[
    {
        "id": 543,
        "storeId": 17,
        "storeName": "Jasraj",
        "siteName": "Hey",
        "city": "BANGALORE",
        "state": null,
        "addressLine1": "C/o chirag nivas Nisarga layout 6th cross basavanpura main road kr puram",
        "addressLine2": "Gayathri layout, kr puram",
        "startDate": "2024-11-06",
        "endDate": "2024-11-13",
        "status": "active",
        "completionStatus": null,
        "brandsInUse": [
            "World"
        ],
        "requirement": 2222.0,
        "completed": 1111.0,
        "professionals": [
            {
                "id": 1,
                "name": "Payal",
                "contact": "8811223456",
                "role": "architect",
                "storeId": 17,
                "storeName": "Jasraj"
            },
            {
                "id": 2,
                "name": "Payal Gupta",
                "contact": "1234567890",
                "role": "engineer",
                "storeId": 17,
                "storeName": "Jasraj"
            },
            {
                "id": 3,
                "name": "Payal",
                "contact": "223342",
                "role": "architect",
                "storeId": 17,
                "storeName": "Jasraj"
            },
            {
                "id": 4,
                "name": "get_user_profile",
                "contact": "223342",
                "role": "architect",
                "storeId": 17,
                "storeName": "Jasraj"
            },
            {
                "id": 5,
                "name": "get_user_profile",
                "contact": "33333",
                "role": "architect",
                "storeId": 17,
                "storeName": "Jasraj"
            },
            {
                "id": 6,
                "name": "get_user_profile",
                "contact": "33333",
                "role": "engineer",
                "storeId": 17,
                "storeName": "Jasraj"
            },
            {
                "id": 7,
                "name": "XYZ",
                "contact": "33333",
                "role": "builder",
                "storeId": 17,
                "storeName": "Jasraj"
            }
        ],
        "createdAt": "2024-11-06",
        "createdTime": "21:33:13.166",
        "updatedAt": "2024-11-07",
        "updatedTime": "12:28:40.473"
    },
    {
        "id": 547,
        "storeId": 17,
        "storeName": "Jasraj",
        "siteName": "hhh",
        "city": "BANGALORE",
        "state": null,
        "addressLine1": "C/o chirag nivas Nisarga layout 6th cross basavanpura main road kr puram",
        "addressLine2": "Gayathri layout, kr puram",
        "startDate": "2024-11-06",
        "endDate": "2024-12-15",
        "status": "active",
        "completionStatus": null,
        "brandsInUse": [],
        "requirement": 2.3232323E7,
        "completed": 111.0,
        "professionals": null,
        "createdAt": "2024-11-06",
        "createdTime": "22:28:08.936",
        "updatedAt": "2024-11-06",
        "updatedTime": "22:28:08.936"
    },
    {
        "id": 548,
        "storeId": 17,
        "storeName": "Jasraj",
        "siteName": "Hello",
        "city": "BANGALORE",
        "state": null,
        "addressLine1": "C/o chirag nivas Nisarga layout 6th cross basavanpura main road kr puram",
        "addressLine2": "Gayathri layout, kr puram",
        "startDate": "2024-11-06",
        "endDate": "2024-12-15",
        "status": "active",
        "completionStatus": null,
        "brandsInUse": [],
        "requirement": 2.3232323E7,
        "completed": 111.0,
        "professionals": null,
        "createdAt": "2024-11-06",
        "createdTime": "22:29:58.661",
        "updatedAt": "2024-11-06",
        "updatedTime": "22:29:58.661"
    },
    {
        "id": 551,
        "storeId": 17,
        "storeName": "Jasraj",
        "siteName": "Hello",
        "city": "BANGALORE",
        "state": null,
        "addressLine1": "C/o chirag nivas Nisarga layout 6th cross basavanpura main road kr puram",
        "addressLine2": "",
        "startDate": "2024-11-06",
        "endDate": "2024-12-08",
        "status": "active",
        "completionStatus": null,
        "brandsInUse": [],
        "requirement": 2.3232323E7,
        "completed": 111.0,
        "professionals": null,
        "createdAt": "2024-11-06",
        "createdTime": "22:38:27.114",
        "updatedAt": "2024-11-06",
        "updatedTime": "22:38:27.115"
    },
    {
        "id": 561,
        "storeId": 17,
        "storeName": "Jasraj",
        "siteName": "Hello",
        "city": "BANGALORE",
        "state": null,
        "addressLine1": null,
        "addressLine2": null,
        "startDate": "2024-11-26",
        "endDate": "2024-12-29",
        "status": "active",
        "completionStatus": null,
        "brandsInUse": [
            "hello"
        ],
        "requirement": 111.0,
        "completed": 1111.0,
        "professionals": null,
        "createdAt": "2024-11-07",
        "createdTime": "20:06:06.911",
        "updatedAt": "2024-11-07",
        "updatedTime": "20:06:06.911"
    },
    {
        "id": 562,
        "storeId": 17,
        "storeName": "Jasraj",
        "siteName": "Apple",
        "city": "BANGALORE",
        "state": null,
        "addressLine1": null,
        "addressLine2": null,
        "startDate": "2024-11-06",
        "endDate": "2024-12-08",
        "status": "active",
        "completionStatus": null,
        "brandsInUse": [
            "hello"
        ],
        "requirement": 2222.0,
        "completed": 1111.0,
        "professionals": null,
        "createdAt": "2024-11-07",
        "createdTime": "20:15:23.182",
        "updatedAt": "2024-11-07",
        "updatedTime": "20:15:23.182"
    }
]





Store Professional(Architect, Engineer, Builder)
Add For Store
Post Call
http://localhost:8081/professionals/addForStore
PayLoad:
{
    "name":"name",
    "role":"engineer",
    "contact":1234567890,
    "storeId":1
}
Response:
1
Edit
Put Call
http://localhost:8081/professionals/edit?professionalId=1
PayLoad:
{
    "name":"abc",
    "role":"engineer",
    "contact":1234567890,
    "storeId":1
}
Response:
1
Delete
Delete Call
http://localhost:8081/professionals/delete?professionalId=1
Response:
Professional deleted successfully

Get By Store
Get Call
http://localhost:8081/professionals/getByStore?storeId=1
Response:
[
    {
        "id": 1,
        "name": "abc",
        "contact": "1234567890",
        "role": "engineer",
        "storeId": 1,
        "storeName": "store1"
    }
]

BRANDS(Daily Pricing)
Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/brand/create
PayLoad:
{
    "brandName":"Brand 1",
    "price":12.0,
    "employeeDto":{
        "id":1
    },
    "city":"Pune",
    "state":"Maharashtra",
    "district":"District1",
    "subDistrict":"SubDistrict1"
}
Response:
1
Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/brand/edit?id=1
PayLoad:
{
    "brandName":"Brand 1",
    "price":1.0,
    "employeeDto":{
        "id":1
    },
    "city":"Pune",
    "state":"Maharashtra",
    "district":"District1",
    "subDistrict":"SubDistrict1"
}
Response:
1
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/brand/getAll
Response:
[
    {
        "id": 1,
        "brandName": "Brand 1",
        "price": 15.0,
        "metric": null,
        "city": "Pune",
        "state": "Maharashtra",
        "employeeDto": {
            "id": 1,
            "firstName": "Shilpa",
            "lastName": "K",
            "employeeId": "E101",
            "primaryContact": 9892868637,
            "secondaryContact": 8104846414,
            "departmentName": "Sales",
            "email": "s@k.com",
            "role": "Field Officer",
            "addressLine1": "address1",
            "addressLine2": "address2",
            "city": "Mumbai",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "dateOfJoining": "2017-01-12",
            "userDto": {
                "username": "Shilpa",
                "password": null,
                "plainPassword": null,
                "roles": null,
                "employeeId": null,
                "firstName": null,
                "lastName": null
            },
            "travelAllowance": 100.0,
            "dearnessAllowance": 100.0,
            "createdAt": "2024-03-21",
            "updatedAt": "2024-03-21",
            "createdTime": "23:19:26.173",
            "updatedTime": "23:19:26.173",
            "companyId": null,
            "companyName": null,
            "fullMonthSalary": 6000.0
        },
        "district": "District1",
        "subDistrict": "SubDistrict1",
        "createdAt": "2024-06-12",
        "createdTime": "20:10:54.189",
        "updatedAt": "2024-06-12",
        "updatedTime": "20:11:50.405"
    }
]
Get By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/brand/getById?id=1
Response:
{
    "id": 1,
    "brandName": "Brand 1",
    "price": 15.0,
    "city": "Pune",
    "state": "Maharashtra",
    "employeeDto": {
        "id": 1,
        "firstName": "Shilpa",
        "lastName": "K",
        "employeeId": "E101",
        "primaryContact": 9892868637,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "userDto": {
            "username": "Shilpa",
            "password": null,
            "plainPassword": null,
            "roles": null,
            "employeeId": null,
            "firstName": null,
            "lastName": null
        },
        "travelAllowance": 100.0,
        "dearnessAllowance": 100.0,
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": "23:19:26.173",
        "updatedTime": "23:19:26.173",
        "companyId": null,
        "companyName": null,
        "fullMonthSalary": 6000.0
    },
    "district": "District1",
    "subDistrict": "SubDistrict1",
    "createdAt": "2024-06-12",
    "createdTime": "20:10:54.189",
    "updatedAt": "2024-06-12",
    "updatedTime": "20:11:50.405"
}
Get By Team And Date Range
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/brand/getByTeamAndDate?id=51&start=2024-06-01&end=2024-07-05
Response:
[
    {
        "id": 2,
        "brandName": "XYZ",
        "price": 12000.0,
        "metric": null,
        "city": "Bengaluru",
        "state": "Karnataka",
        "employeeDto": {
            "id": 33,
            "firstName": "Yash",
            "lastName": "Puri",
            "employeeId": "",
            "primaryContact": 9765723830,
            "secondaryContact": null,
            "status": null,
            "departmentName": "Sales",
            "email": "yashmitian@gmail.com",
            "role": "Field Officer",
            "addressLine1": "23, Maa, behind funskool",
            "addressLine2": "Near azad maidan",
            "city": "Jalna",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 421203,
            "dateOfJoining": null,
            "userDto": {
                "username": "Yash123",
                "password": null,
                "plainPassword": null,
                "roles": null,
                "employeeId": null,
                "firstName": null,
                "lastName": null
            },
            "teamId": 51,
            "isOfficeManager": false,
            "assignedCity": null,
            "travelAllowance": 100.0,
            "dearnessAllowance": 100.0,
            "createdAt": "2024-04-26",
            "updatedAt": "2024-04-26",
            "createdTime": "06:16:19.323",
            "updatedTime": "06:16:19.323",
            "companyId": null,
            "companyName": null,
            "fullMonthSalary": 20000.0
        },
        "district": "District1",
        "subDistrict": "SubDistrict1",
        "createdAt": "2024-06-15",
        "createdTime": "22:52:17.3",
        "updatedAt": "2024-06-15",
        "updatedTime": "22:52:17.3"
    }
]

Get By Date Range
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/brand/getByDateRange?start=2024-06-11&end=2024-06-12
Response:
[
    {
        "id": 1,
        "brandName": "Brand 1",
        "price": 15.0,
        "city": "Pune",
        "state": "Maharashtra",
        "employeeDto": {
            "id": 1,
            "firstName": "Shilpa",
            "lastName": "K",
            "employeeId": "E101",
            "primaryContact": 9892868637,
            "secondaryContact": 8104846414,
            "departmentName": "Sales",
            "email": "s@k.com",
            "role": "Field Officer",
            "addressLine1": "address1",
            "addressLine2": "address2",
            "city": "Mumbai",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "dateOfJoining": "2017-01-12",
            "userDto": {
                "username": "Shilpa",
                "password": null,
                "plainPassword": null,
                "roles": null,
                "employeeId": null,
                "firstName": null,
                "lastName": null
            },
            "travelAllowance": 100.0,
            "dearnessAllowance": 100.0,
            "createdAt": "2024-03-21",
            "updatedAt": "2024-03-21",
            "createdTime": "23:19:26.173",
            "updatedTime": "23:19:26.173",
            "companyId": null,
            "companyName": null,
            "fullMonthSalary": 6000.0
        },
        "district": "District1",
        "subDistrict": "SubDistrict1",
        "createdAt": "2024-06-12",
        "createdTime": "20:10:54.189",
        "updatedAt": "2024-06-12",
        "updatedTime": "20:11:50.405"
    }
]
Get By Date Range And Employee
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/brand/getByDateRangeForEmployee?start=2024-06-11&end=2024-06-12&id=1
Response:
[
    {
        "id": 1,
        "brandName": "Brand 1",
        "price": 15.0,
        "city": "Pune",
        "state": "Maharashtra",
        "employeeDto": {
            "id": 1,
            "firstName": "Shilpa",
            "lastName": "K",
            "employeeId": "E101",
            "primaryContact": 9892868637,
            "secondaryContact": 8104846414,
            "departmentName": "Sales",
            "email": "s@k.com",
            "role": "Field Officer",
            "addressLine1": "address1",
            "addressLine2": "address2",
            "city": "Mumbai",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "dateOfJoining": "2017-01-12",
            "userDto": {
                "username": "Shilpa",
                "password": null,
                "plainPassword": null,
                "roles": null,
                "employeeId": null,
                "firstName": null,
                "lastName": null
            },
            "travelAllowance": 100.0,
            "dearnessAllowance": 100.0,
            "createdAt": "2024-03-21",
            "updatedAt": "2024-03-21",
            "createdTime": "23:19:26.173",
            "updatedTime": "23:19:26.173",
            "companyId": null,
            "companyName": null,
            "fullMonthSalary": 6000.0
        },
        "district": "District1",
        "subDistrict": "SubDistrict1",
        "createdAt": "2024-06-12",
        "createdTime": "20:10:54.189",
        "updatedAt": "2024-06-12",
        "updatedTime": "20:11:50.405"
    }
]
Delete
Delete call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/brand/delete?id=1
Response:
Object Deletd!
VISIT
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getAll
Response:
[
    {
        "id": 1,
        "storeId": 2,
        "storeName": "store2",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "employeeId": 1,
 "visitIntentId": null,
        "visitIntentValue": null,


        "employeeName": "Shilpa K",
        "visit_date": "2024-03-10",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": null,
        "visitLongitude": null,
        "checkinLatitude": null,
        "checkinLongitude": null,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": null,
        "checkoutDate": null,
        "checkinTime": null,
        "checkoutTime": null,
        "purpose": "Follow-up in next week",
        "outcome": null,
        "feedback": null,
        "createdAt": null,
        "createdTime": null,
        "updatedAt": null,
        "updatedTime": null
    }
]
Response with attachment and Intent Log:
[
    {
        "id": 1,
        "storeId": 1,
        "storeName": "store1",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "intent": 3,
        "storePrimaryContact": 123456,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-21",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": 10.0,
        "visitLongitude": -23.0,
        "checkinLatitude": 20.0,
        "checkinLongitude": -20.0,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": "2024-03-22",
        "checkoutDate": "2024-03-22",
        "checkinTime": "13:23:18.015",
        "checkoutTime": "13:33:34.323",
        "purpose": "Follow Up",
        "priority": "low",
        "outcome": "done",
        "feedback": null,
        "attachment": [],
        "attachmentResponse": [
            {
                "fileName": "Second.png",
                "fileDownloadUri": "http://localhost:8081/downloadFile/Second.png",
                "fileType": "image/png",
                "tag": "check-in",
                "size": 0
            }
        ],
        "createdAt": "2024-03-22",
        "createdTime": "12:21:01.271",
        "updatedAt": "2024-03-22",
        "updatedTime": "12:21:01.271",
        "intentAuditLogDto": {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "oldIntentLevel": null,
            "newIntentLevel": 3,
            "employeeId": 1,
            "employeeName": "ShilpaK",
            "changeDate": "2024-03-21",
            "changeTime": "23:35:39.756"
        }
    },
    {
        "id": 2,
        "storeId": 1,
        "storeName": "store1",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "intent": 3,
        "storePrimaryContact": 123456,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-23",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": 10.0,
        "visitLongitude": -23.0,
        "checkinLatitude": null,
        "checkinLongitude": null,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": null,
        "checkoutDate": null,
        "checkinTime": null,
        "checkoutTime": null,
        "purpose": "Follow Up",
        "priority": "low",
        "outcome": null,
        "feedback": null,
        "attachment": [],
        "attachmentResponse": [],
        "createdAt": "2024-03-22",
        "createdTime": "12:21:17.22",
        "updatedAt": "2024-03-22",
        "updatedTime": "12:21:17.22",
        "intentAuditLogDto": {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "oldIntentLevel": null,
            "newIntentLevel": 3,
            "employeeId": 1,
            "employeeName": "ShilpaK",
            "changeDate": "2024-03-21",
            "changeTime": "23:35:39.756"
        }
    }
]


Get By Store Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByStore?id=1
Response:
[
    {
        "id": 1,
        "storeId": 2,
        "storeName": "store2",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-10",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": null,
        "visitLongitude": null,
        "checkinLatitude": null,
        "checkinLongitude": null,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": null,
        "checkoutDate": null,
        "checkinTime": null,
        "checkoutTime": null,
        "purpose": "Follow-up in next week",
        "outcome": null,
        "feedback": null,
        "createdAt": null,
        "createdTime": null,
        "updatedAt": null,
        "updatedTime": null
    }
]
Get Visits For a Date Range(Without Images)
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByDateRange1?start=2024-03-10&end=2024-03-15
Response:
Get Visits For Date Range(Sorted Without images)
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByDateSorted?purpose=Follow%20Up&startDate=2024-05-01&endDate=2024-05-15&page=0&size=10&sort=id,desc

http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByDateSorted?startDate=2024-07-01&endDate=2024-07-01&page=0&size=10&sort=visitDate,desc

Response:
[
    {
        "id": 4,
        "storeId": 5,
        "storeName": "store3",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "intent": null,
        "storePrimaryContact": 2,
        "employeeId": 2,
        "employeeName": "Shubham T",
        "visit_date": "2024-03-11",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": 10.0,
        "visitLongitude": -23.0,
        "checkinLatitude": null,
        "checkinLongitude": null,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": null,
        "checkoutDate": null,
        "checkinTime": null,
        "checkoutTime": null,
        "purpose": "Collection",
        "priority": "low",
        "outcome": null,
        "feedback": null,
        "attachment": [],
        "attachmentResponse": [],
        "visitIntentId": null,
        "visitIntentValue": null,
        "city": "Mumbai",
        "district": null,
        "subDistrict": null,
        "state": "Maharashtra",
        "country": "India",
        "createdAt": "2024-04-19",
        "createdTime": "12:30:16.159",
        "updatedAt": "2024-04-19",
        "updatedTime": "12:30:16.159",
        "intentAuditLogDto": null
    }
]
Get Visits For a Date Range
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByDateRange?start=2024-03-10&end=2024-03-15
Response:
[
    {
        "id": 1,
        "storeId": 2,
        "storeName": "store2",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-10",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": null,
        "visitLongitude": null,
        "checkinLatitude": null,
        "checkinLongitude": null,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": null,
        "checkoutDate": null,
        "checkinTime": null,
        "checkoutTime": null,
        "purpose": "Follow-up in next week",
        "outcome": null,
        "feedback": null,
        "createdAt": null,
        "createdTime": null,
        "updatedAt": null,
        "updatedTime": null
    }
]
Get By Employee Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByEmployee?id=1
Response:
[
    {
        "id": 1,
        "storeId": 2,
        "storeName": "store2",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-10",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": null,
        "visitLongitude": null,
        "checkinLatitude": null,
        "checkinLongitude": null,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": null,
        "checkoutDate": null,
        "checkinTime": null,
        "checkoutTime": null,
        "purpose": "Follow-up in next week",
        "outcome": null,
        "feedback": null,
        "createdAt": null,
        "createdTime": null,
        "updatedAt": null,
        "updatedTime": null
    }
]


Get By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getById?id=1
Response:
{
    "id": 2057,
    "storeId": 33,
    "storeName": "SM traders",
    "storeLatitude": null,
    "storeLongitude": null,
    "intent": 6,
    "storePrimaryContact": 9405068875,
    "employeeId": 33,
    "employeeName": "Yash Puri",
    "visit_date": "2024-06-25",
    "scheduledStartTime": null,
    "scheduledEndTime": null,
    "visitLatitude": null,
    "visitLongitude": null,
    "checkinLatitude": null,
    "checkinLongitude": null,
    "checkoutLatitude": null,
    "checkoutLongitude": null,
    "checkinDate": null,
    "checkoutDate": null,
    "checkinTime": null,
    "checkoutTime": null,
    "purpose": "Hello",
    "priority": "low",
    "outcome": null,
    "feedback": null,
    "attachment": [],
    "attachmentResponse": [],
    "visitIntentId": 7,
    "visitIntentValue": 6,
    "city": "Jalna",
    "district": "Jalna",
    "subDistrict": "Jalna",
    "state": "Maharashtra",
    "country": null,
    "travelAllowance": null,
    "dearnessAllowance": null,
    "salary": null,
    "isSelfGenerated": false,
    "brandsInUse": [
        "Brand D",
        "Brand A"
    ],
    "brandProCons": [
        {
            "id": 5,
            "brandName": "Brand A",
            "pros": [
                "Pro 1",
                "Pro 2"
            ],
            "cons": [
                "Con 1"
            ]
        },
        {
            "id": 6,
            "brandName": "Brand D",
            "pros": [
                "Pro 10",
                "Pro 11"
            ],
            "cons": [
                "Con 8",
                "Con 9"
            ]
        }
    ],
    "assignedById": 86,
    "assignedByName": "Test 1",
    "statsDto": null,
    "createdAt": "2024-06-25",
    "createdTime": "15:53:35.145",
    "updatedAt": "2024-06-29",
    "updatedTime": "21:27:26.018",
    "intentAuditLogDto": {
        "id": 581,
        "storeId": 33,
        "storeName": "SM traders",
        "oldIntentLevel": null,
        "newIntentLevel": 3,
        "employeeId": 33,
        "employeeName": "YashPuri",
        "changeDate": "2024-05-13",
        "changeTime": "10:01:14.467",
        "visitId": null
    },
    "monthlySale": 2000.0
}


With Attachemnts:
{
    "id": 1,
    "storeId": 1,
    "storeName": "store1",
    "storeLatitude": 10.0,
    "storeLongitude": -23.0,
    "intent": 3,
    "storePrimaryContact": 123456,
    "employeeId": 1,
    "employeeName": "Shilpa K",
    "visit_date": "2024-03-21",
    "scheduledStartTime": null,
    "scheduledEndTime": null,
    "visitLatitude": 10.0,
    "visitLongitude": -23.0,
    "checkinLatitude": 20.0,
    "checkinLongitude": -20.0,
    "checkoutLatitude": null,
    "checkoutLongitude": null,
    "checkinDate": "2024-03-22",
    "checkoutDate": "2024-03-22",
    "checkinTime": "13:23:18.015",
    "checkoutTime": "13:33:34.323",
    "purpose": "Follow Up",
    "priority": "low",
    "outcome": "done",
    "feedback": null,
    "attachment": [],
    "attachmentResponse": [
        {
            "id": 4,
            "fileName": "Second.png",
            "url": "[B@41eee281",
            "tag": null
        },
        {
            "id": 6,
            "fileName": "Exception-Handling-768.png",
            "url": "[B@7bacfcfa",
            "tag": "check-in"
        }
    ],
    "createdAt": "2024-03-22",
    "createdTime": "12:21:01.271",
    "updatedAt": "2024-03-22",
    "updatedTime": "12:21:01.271"
}
Get My Visits
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getMyVisit
Response:
[
    {
        "id": 1,
        "storeId": 1,
        "storeName": "store1",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "intent": 3,
        "storePrimaryContact": 123456,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-21",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": 10.0,
        "visitLongitude": -23.0,
        "checkinLatitude": 20.0,
        "checkinLongitude": -20.0,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": "2024-03-22",
        "checkoutDate": "2024-03-22",
        "checkinTime": "13:23:18.015",
        "checkoutTime": "13:33:34.323",
        "purpose": "Follow Up",
        "priority": "low",
        "outcome": "done",
        "feedback": null,
        "attachment": [],
        "attachmentResponse": [
            {
                "fileName": "Second.png",
                "fileDownloadUri": "http://localhost:8081/downloadFile/Second.png",
                "fileType": "image/png",
                "tag": "check-in",
                "size": 0
            }
        ],
        "createdAt": "2024-03-22",
        "createdTime": "12:21:01.271",
        "updatedAt": "2024-03-22",
        "updatedTime": "12:21:01.271",
        "intentAuditLogDto": {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "oldIntentLevel": null,
            "newIntentLevel": 3,
            "employeeId": 1,
            "employeeName": "ShilpaK",
            "changeDate": "2024-03-21",
            "changeTime": "23:35:39.756"
        }
    },
    {
        "id": 2,
        "storeId": 1,
        "storeName": "store1",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "intent": 3,
        "storePrimaryContact": 123456,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-23",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": 10.0,
        "visitLongitude": -23.0,
        "checkinLatitude": null,
        "checkinLongitude": null,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": null,
        "checkoutDate": null,
        "checkinTime": null,
        "checkoutTime": null,
        "purpose": "Follow Up",
        "priority": "low",
        "outcome": null,
        "feedback": null,
        "attachment": [],
        "attachmentResponse": [],
        "createdAt": "2024-03-22",
        "createdTime": "12:21:17.22",
        "updatedAt": "2024-03-22",
        "updatedTime": "12:21:17.22",
        "intentAuditLogDto": {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "oldIntentLevel": null,
            "newIntentLevel": 3,
            "employeeId": 1,
            "employeeName": "ShilpaK",
            "changeDate": "2024-03-21",
            "changeTime": "23:35:39.756"
        }
    }
]
Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/edit?id=1
PayLoad:
{    
    "visit_date":"2024-03-10"
}
Response:
Visit Updated Successfully!
Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/delete?id=3
Response:
Visit Deleted Successfully!
Create
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/create
PayLoad:
{    
    "storeId":2,
    "employeeId":1,
    "visit_date":"2024-03-11",
 "isSelfGenerated":true,
    "purpose":"Follow-up in next week"
}
PayLoad(For Employee Generated):
{    
    "storeId":3,
    "employeeId":1,
    "visit_date":"2024-03-11",
    "purpose":"Follow-up in next week",
    "isSelfGenerated":false,
    "assignedById":2
}
Response:
1
Check In For Visit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/checkin?id=1
PayLoad:
{
    "checkinLatitude":20,
    "checkinLongitude":-20
}
Success Response:
Checked In Successfully!
Error Message:
Error Checking in: Already Checked In!
Check Out For Visit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/checkout?id=1
PayLoad:
{
    "checkoutLatitude":25,
    "checkoutLongitude":-25,
    "outcome":"done"
}
Success Response:
Checked out Successfully!
Error Response:
Error Checking out: Cant check out without Checking in!
Error Checking out: Already Checked Out!
Add Attachment
Tag value(check-in/ check-out)
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/uploadFile?id=1&tag=check-in
PayLoad:
File
Response(Visit Id):
1
Delete Attachment
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/removeFile?id=1
PayLoad:
{
    "ids":[
        3
    ]
}
Response:
Attachments deleted successfully from the visit.
Get Attachment
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getFiles?id=1
Response:
[
    "/visit/images/1/0"
]
Image Link
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/images/1/0

http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/downloadFile/32/check-in/0FF92EA8-967B-4FF2-847A-A96EDDBE46D5.jpg
Add/Edit Brands and Pro Cons To Visit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/addProCons?visitId=2057
PayLoad:
[
    {
      "brandName": "Brand A",
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "cons": ["Con 1", "Con 2"]
    },
    {
      "brandName": "Brand D",
      "pros": ["Pro 10", "Pro 11"],
      "cons": ["Con 8", "Con 9"]
    }
  ]

Delete Pro Cons
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/deleteProCons?visitId=2057
PayLoad:
[
    {
        "brandName":"Brand A"
    },
    {
	"brandName":"Brand B"
    }
]
Success Response:
Pros Cons Deleted Successfully!
Get Brands Pro Cons For a Visit
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getProCons?visitId=2057
Response:
[
    {
        "id": null,
        "brandName": "Brand A",
        "pros": [
            "Pro 1",
            "Pro 2",
            "Pro 3"
        ],
        "cons": [
            "Con 1",
            "Con 2"
        ]
    },
    {
        "id": null,
        "brandName": "Brand D",
        "pros": [
            "Pro 10",
            "Pro 11"
        ],
        "cons": [
            "Con 8",
            "Con 9"
        ]
    }
]

Edit monthly Sale
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/editMonthlySale?visitId=2057&monthlySale=2000
Response:
Monthly Sale Updated For Visit
Get Monthly Sale For a Visit
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/monthly-sale/getByVisit?visitId=2057
New Response:
[
    {
        "id": 1,
        "storeId": 3,
        "storeName": "store3",
        "oldMonthlySale": 230000.0,
        "newMonthlySale": 2000.0,
        "visitId": 3,
        "visitDate": "2024-04-11",
        "employeeId": 3,
        "employeeName": "Jyoti T",
        "changeDate": "2024-07-02",
        "changeTime": "13:09:42.197"
    }
]


Response:
{
    "id": 1,
    "storeId": 33,
    "storeName": "SM traders",
    "oldMonthlySale": null,
    "newMonthlySale": 2000.0,
    "visitId": 2057,
    "visitDate": "2024-06-25",
    "employeeId": 33,
    "employeeName": "Yash Puri",
    "changeDate": "2024-06-29",
    "changeTime": "15:57:25.909"
}

Intent Audit Get By Visit
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/intent-audit/getByVisit?id=2057
Response:
[
    {
        "id": 1623,
        "storeId": 33,
        "storeName": "SM traders",
        "oldIntentLevel": 6,
        "newIntentLevel": 6,
        "employeeId": 33,
        "employeeName": "YashPuri",
        "changeDate": "2024-06-30",
        "changeTime": "17:40:03.453",
        "visitId": 2057
    },
    {
        "id": 1624,
        "storeId": 33,
        "storeName": "SM traders",
        "oldIntentLevel": 6,
        "newIntentLevel": 6,
        "employeeId": 33,
        "employeeName": "YashPuri",
        "changeDate": "2024-06-30",
        "changeTime": "18:29:12.921",
        "visitId": 2057
    },
    {
        "id": 1625,
        "storeId": 33,
        "storeName": "SM traders",
        "oldIntentLevel": 6,
        "newIntentLevel": 6,
        "employeeId": 33,
        "employeeName": "YashPuri",
        "changeDate": "2024-06-30",
        "changeTime": "18:34:07.475",
        "visitId": 2057
    },
    {
        "id": 1626,
        "storeId": 33,
        "storeName": "SM traders",
        "oldIntentLevel": 6,
        "newIntentLevel": 6,
        "employeeId": 33,
        "employeeName": "YashPuri",
        "changeDate": "2024-06-30",
        "changeTime": "19:51:29.778",
        "visitId": 2057
    }
]



GET By Employee And Date Range with TA, DA, And Visit Count
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByDateRangeAndEmployeeStats?id=1&start=2024-03-01&end=2024-03-31
Response:
{
    "statsDto": {
        "visitCount": 4,
        "fullDays": 0,
        "halfDays": 0,
        "absences": 3
    },
    "visitDto": [
        {
            "id": 2,
            "storeId": 1,
            "storeName": "store1",
            "storeLatitude": 10.0,
            "storeLongitude": -23.0,
            "intent": 3,
            "storePrimaryContact": 123456,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "visit_date": "2024-03-23",
            "scheduledStartTime": null,
            "scheduledEndTime": null,
            "visitLatitude": 10.0,
            "visitLongitude": -23.0,
            "checkinLatitude": null,
            "checkinLongitude": null,
            "checkoutLatitude": null,
            "checkoutLongitude": null,
            "checkinDate": "2024-04-13",
            "checkoutDate": null,
            "checkinTime": "12:43:38.519",
            "checkoutTime": null,
            "purpose": "Follow Up",
            "priority": "low",
            "outcome": null,
            "feedback": null,
            "attachment": [],
            "attachmentResponse": [],
            "visitIntentId": 7,
            "visitIntentValue": 6,
            "city": "Mumbai",
            "district": null,
            "subDistrict": null,
            "state": "Maharashtra",
            "country": "India",
            "travelAllowance": 100.0,
            "dearnessAllowance": 100.0,
            "salary": 5000.0,
            "statsDto": null,
            "createdAt": "2024-03-22",
            "createdTime": "12:21:17.22",
            "updatedAt": "2024-03-22",
            "updatedTime": "12:21:17.22",
            "intentAuditLogDto": null
        }
    ]
}
Get For Team
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getForTeam?teamId=1&startDate=2024-03-01&endDate=2024-05-31&purpose=Follow%20Up&priority=High&storeName=Store&page=0&size=10&sort=visitDate,desc
Response:
{
    "content": [
        {
            "id": 5,
            "storeId": 3,
            "storeName": "store3",
            "storeLatitude": 10.0,
            "storeLongitude": -23.0,
            "intent": null,
            "storePrimaryContact": 456,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "visit_date": "2024-03-11",
            "scheduledStartTime": null,
            "scheduledEndTime": null,
            "visitLatitude": 10.0,
            "visitLongitude": -23.0,
            "checkinLatitude": null,
            "checkinLongitude": null,
            "checkoutLatitude": null,
            "checkoutLongitude": null,
            "checkinDate": null,
            "checkoutDate": null,
            "checkinTime": null,
            "checkoutTime": null,
            "purpose": "Follow-up in next week",
            "priority": "low",
            "outcome": null,
            "feedback": null,
            "attachment": [],
            "attachmentResponse": [],
            "visitIntentId": null,
            "visitIntentValue": null,
            "city": "Mumbai",
            "district": null,
            "subDistrict": null,
            "state": "Maharashtra",
            "country": "India",
            "travelAllowance": null,
            "dearnessAllowance": null,
            "salary": null,
            "isSelfGenerated": false,
            "assignedById": 2,
            "assignedByName": "Shubham T",
            "statsDto": null,
            "createdAt": "2024-06-21",
            "createdTime": "11:26:10.105",
            "updatedAt": "2024-06-21",
            "updatedTime": "11:32:29.097",
            "intentAuditLogDto": null
        },
        {
            "id": 2,
            "storeId": 1,
            "storeName": "store1",
            "storeLatitude": 10.0,
            "storeLongitude": -23.0,
            "intent": 3,
            "storePrimaryContact": 123456,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "visit_date": "2024-03-23",
            "scheduledStartTime": null,
            "scheduledEndTime": null,
            "visitLatitude": 10.0,
            "visitLongitude": -23.0,
            "checkinLatitude": null,
            "checkinLongitude": null,
            "checkoutLatitude": 20.0,
            "checkoutLongitude": -20.0,
            "checkinDate": "2024-04-13",
            "checkoutDate": "2024-06-06",
            "checkinTime": "12:43:38.519",
            "checkoutTime": "15:02:01.314",
            "purpose": "Follow Up",
            "priority": "low",
            "outcome": null,
            "feedback": null,
            "attachment": [],
            "attachmentResponse": [],
            "visitIntentId": 7,
            "visitIntentValue": 6,
            "city": "Mumbai",
            "district": null,
            "subDistrict": null,
            "state": "Maharashtra",
            "country": "India",
            "travelAllowance": null,
            "dearnessAllowance": null,
            "salary": null,
            "isSelfGenerated": null,
            "assignedById": null,
            "assignedByName": null,
            "statsDto": null,
            "createdAt": "2024-03-22",
            "createdTime": "12:21:17.22",
            "updatedAt": "2024-06-06",
            "updatedTime": "15:02:01.314",
            "intentAuditLogDto": {
                "id": 1,
                "storeId": 1,
                "storeName": "store1",
                "oldIntentLevel": null,
                "newIntentLevel": 3,
                "employeeId": 1,
                "employeeName": "ShilpaK",
                "changeDate": "2024-03-21",
                "changeTime": "23:35:39.756",
                "visitId": null
            }
        },
        {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "storeLatitude": 10.0,
            "storeLongitude": -23.0,
            "intent": 3,
            "storePrimaryContact": 123456,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "visit_date": "2024-03-21",
            "scheduledStartTime": null,
            "scheduledEndTime": null,
            "visitLatitude": 10.0,
            "visitLongitude": -23.0,
            "checkinLatitude": 20.0,
            "checkinLongitude": -20.0,
            "checkoutLatitude": null,
            "checkoutLongitude": null,
            "checkinDate": "2024-03-22",
            "checkoutDate": "2024-03-22",
            "checkinTime": "13:23:18.015",
            "checkoutTime": "13:33:34.323",
            "purpose": "Follow Up",
            "priority": "low",
            "outcome": "done",
            "feedback": null,
            "attachment": [],
            "attachmentResponse": [
                {
                    "fileName": "Test case.JPG",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Test%20case.JPG",
                    "fileType": "image/jpeg",
                    "tag": "check-in",
                    "size": 0
                }
            ],
            "visitIntentId": 3,
            "visitIntentValue": 2,
            "city": "Mumbai",
            "district": null,
            "subDistrict": null,
            "state": "Maharashtra",
            "country": "India",
            "travelAllowance": null,
            "dearnessAllowance": null,
            "salary": null,
            "isSelfGenerated": null,
            "assignedById": null,
            "assignedByName": null,
            "statsDto": null,
            "createdAt": "2024-03-22",
            "createdTime": "12:21:01.271",
            "updatedAt": "2024-05-17",
            "updatedTime": "15:45:36.749",
            "intentAuditLogDto": {
                "id": 1,
                "storeId": 1,
                "storeName": "store1",
                "oldIntentLevel": null,
                "newIntentLevel": 3,
                "employeeId": 1,
                "employeeName": "ShilpaK",
                "changeDate": "2024-03-21",
                "changeTime": "23:35:39.756",
                "visitId": null
            }
        }
    ],
    "pageable": {
        "pageNumber": 0,
        "pageSize": 10,
        "sort": {
            "empty": false,
            "sorted": true,
            "unsorted": false
        },
        "offset": 0,
        "unpaged": false,
        "paged": true
    },
    "last": true,
    "totalElements": 3,
    "totalPages": 1,
    "size": 10,
    "number": 0,
    "sort": {
        "empty": false,
        "sorted": true,
        "unsorted": false
    },
    "first": true,
    "numberOfElements": 3,
    "empty": false
}




Attendance Request
Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/request/create
Response:
{
    "employeeId":2,
    "logDate":"2024-03-07",
    "requestedStatus":"full day"
}


Get all
Get Call
http://localhost:8081/request/getAll
Response:
[
    {
        "id": 1,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "requestDate": "2024-09-03",
        "logDate": null,
        "actionDate": null,
        "status": "pending"
    },
    {
        "id": 2,
        "employeeId": 2,
        "employeeName": "Shubham T",
        "requestDate": "2024-09-03",
        "logDate": null,
        "actionDate": null,
        "status": "pending"
    }
]
Get By Status
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/request/getByStatus?status=pending
Response:
[
    {
        "id": 1,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "requestDate": "2024-09-03",
        "logDate": null,
        "actionDate": null,
        "status": "pending"
    },
    {
        "id": 2,
        "employeeId": 2,
        "employeeName": "Shubham T",
        "requestDate": "2024-09-03",
        "logDate": null,
        "actionDate": null,
        "status": "pending"
    }
]
Get By Date
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/request/getByDateRange?start=2024-08-20&end=2024-09-03
Update Status
Put Call(id in header is request id)
http://localhost:8081/request/updateStatus?id=1&status=approved&attendance=half%20day


VISIT PURPOSE
Add Purpose
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/purpose/add
PayLoad:
{
    "purpose":"Return"
}
Response:
Purpose added successfully
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/purpose/getAll
Response:
[
    {
        "purpose": "Return"
    },
    {
        "purpose": "Follow up"
    },
    {
        "purpose": "Payment Collection"
    }
]
Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/purpose?purpose=Payment


CUSTOMER (STORE/ CLIENT)
Create
POST Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/create
{
        "storeName":"store2",
        "clientFirstName":"abcd",
        "clientLastName":"abcd",
        "primaryContact":23456,
        "secondaryContact":"123456",
        "email":"abc@gmail.com",
        "industry":"industry2",
        "companySize":55,
        "gstNumber":"gst12356",
        "addressLine1":"addressLine1",
        "addressLine2":"addressLine2",
        "city":"Mumbai",
        "state":"Maharashtra",
        "country":"India",
        "pincode":410206,
        "latitude":10.00,
        "longitude":-23.00,
        "monthlySale":230000,
        "clientType":"clientType1",
        "employeeId":1,
        "brandProCons": [
        {
            "brand": "Brand A",
            "pros": ["Good quality", "Affordable"],
            "cons": ["Limited models", "Long delivery times"]
        },
        {
            "brand": "Brand B",
            "pros": ["Excellent support", "Wide range"],
            "cons": ["Higher price", "Complex configurations"]
        }
  ]
}  
Success Response:
Store Saved Successfully
Get By Page Sorted
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByPageSorted?pageNumber=1&pageSize=4
PayLoad:
{
    "sortBy": ["storeName","city"],
    "sortOrder": ["asc","desc"]
}
Response:
[
    {
        "landmark": null,
        "district": null,
        "subDistrict": null,
        "managers": [],
        "latitude": 10.0,
        "longitude": -23.0,
        "intent": null,
        "brandsInUse": [],
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "monthlySale": 230000.0,
        "brandProCons": [],
        "clientType": "clientType1",
        "totalVisitCount": 0,
        "visitThisMonth": 0,
        "lastVisitDate": null,
        "outcomeLastVisit": null,
        "createdAt": "2024-05-06",
        "updatedAt": "2024-05-06",
        "createdTime": null,
        "updatedTime": null,
        "storeId": 7,
        "storeName": "1",
        "clientFirstName": "abcd",
        "clientLastName": "abcd",
        "primaryContact": 1,
        "secondaryContact": 1,
        "email": "abc@gmail.com",
        "industry": "industry2",
        "companySize": 55,
        "gstNumber": "gst11",
        "addressLine1": "addressLine1",
        "addressLine2": "addressLine2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "likes": {}
    }
]
Get State wise Data
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getStateWise
Response:
[
    {
        "state": "Maharashtra",
        "employeeCount": 2,
        "visitCount": 24,
        "storeCount": 13
    }
]
Get By Page
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByPage?pageNumber=4&pageSize=10
Response:
[
    {
        "landmark": null,
        "district": null,
        "subDistrict": null,
        "managers": [],
        "latitude": 10.0,
        "longitude": -23.0,
        "intent": null,
        "brandsInUse": [],
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "monthlySale": 230000.0,
        "brandProCons": [],
        "clientType": "clientType1",
        "totalVisitCount": 0,
        "visitThisMonth": 0,
        "lastVisitDate": null,
        "outcomeLastVisit": null,
        "createdAt": "2024-05-06",
        "updatedAt": "2024-05-06",
        "createdTime": null,
        "updatedTime": null,
        "storeId": 11,
        "storeName": "4",
        "clientFirstName": "abcd",
        "clientLastName": "abcd",
        "primaryContact": 5,
        "secondaryContact": 1,
        "email": "abc@gmail.com",
        "industry": "industry2",
        "companySize": 55,
        "gstNumber": "gst14",
        "addressLine1": "addressLine1",
        "addressLine2": "addressLine2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "likes": {}
    },
    {
        "landmark": null,
        "district": null,
        "subDistrict": null,
        "managers": [],
        "latitude": 10.0,
        "longitude": -23.0,
        "intent": null,
        "brandsInUse": [],
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "monthlySale": 230000.0,
        "brandProCons": [],
        "clientType": "clientType1",
        "totalVisitCount": 0,
        "visitThisMonth": 0,
        "lastVisitDate": null,
        "outcomeLastVisit": null,
        "createdAt": "2024-05-06",
        "updatedAt": "2024-05-06",
        "createdTime": null,
        "updatedTime": null,
        "storeId": 13,
        "storeName": "5",
        "clientFirstName": "abcd",
        "clientLastName": "abcd",
        "primaryContact": 6,
        "secondaryContact": 1,
        "email": "abc@gmail.com",
        "industry": "industry2",
        "companySize": 55,
        "gstNumber": "gst15",
        "addressLine1": "addressLine1",
        "addressLine2": "addressLine2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "likes": {}
    }
]
Get Store By Name
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByName?name=store1
Response:
[
    {
        "managers": [],
        "latitude": 12.003,
        "longitude": -23.89,
        "brandsInUse": [],
        "monthlySale": 230000.0,
        "brandProCons": [],
        "notes": null,
        "clientType": "clientType1",
        "createdAt": "2024-03-08",
        "updatedAt": "2024-03-08",
        "storeId": 1,
        "storeName": "store1",
        "clientFirstName": "abcd",
        "clientLastName": "abcd",
        "primaryContact": 12345,
        "secondaryContact": 123456,
        "email": "abc@gmail.com",
        "industry": "industry1",
        "companySize": 50,
        "gstNumber": "gst123",
        "addressLine1": "addressLine1",
        "addressLine2": "addressLine2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206
    }
]
Get Store By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getById?id=1
Response:
{
    "managers": [],
    "latitude": 37.7749,
    "longitude": -122.4194,
    "totalVisitCount": 2,
    "visitThisMonth": 1,
    "lastVisitDate": null,
    "outcomeLastVisit": null,


    "brandsInUse": [
        "Brand A",
        "Brand B"
    ],
    "monthlySale": 50000.0,
    "brandProCons": [],
    "notes": [
        "Follow up next month",
        "Send updated catalog"
    ],
    "clientType": "B2B",
    "likes": {},
    "createdAt": "2024-03-09",
    "updatedAt": "2024-03-09",
    "storeId": 1,
    "storeName": "Tech Gadgets Plus",
    "employeeId": 1,
    "employeeName": "Shilpa K",


    "clientFirstName": "John",
    "clientLastName": "Doe",
    "primaryContact": 1234567890,
    "secondaryContact": 1987654321,
    "email": "john.doe@example.com",
    "industry": "Electronics",
    "companySize": 50,
    "gstNumber": "gst1234",
    "addressLine1": "123 Tech Lane",
    "addressLine2": "Suite 100",
    "city": "Techville",
    "state": "Techstate",
    "country": "Techland",
    "pincode": 123456
}




79029dd45c76443e84af8727f49462f2


Get By Phone
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByPhone?phone=456
Response:
{
    "landmark": null,
    "district": null,
    "subDistrict": null,
    "managers": [],
    "latitude": 10.0,
    "longitude": -23.0,
    "intent": null,
    "brandsInUse": [],
    "employeeId": 2,
    "employeeName": "Shubham T",
    "monthlySale": 230000.0,
    "brandProCons": [],
    "clientType": "shop",
    "totalVisitCount": null,
    "visitThisMonth": null,
    "lastVisitDate": null,
    "outcomeLastVisit": null,
    "createdAt": "2024-04-13",
    "updatedAt": "2024-04-13",
    "createdTime": null,
    "updatedTime": null,
    "storeId": 3,
    "storeName": "store3",
    "clientFirstName": "abcd",
    "clientLastName": "abcd",
    "primaryContact": 456,
    "secondaryContact": 123456,
    "email": "abc@gmail.com",
    "industry": "industry2",
    "companySize": 55,
    "gstNumber": "gst123586",
    "addressLine1": "addressLine1",
    "addressLine2": "addressLine2",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pincode": 410206,
    "likes": {}
}
Get By Filters
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByAllFilter
PayLoad:
{
    "sortBy": ["storeName", "city"],
    "sortOrder": ["asc", "desc"],
    "cityFilter": "Mumbai",
    "ownerNameFilter": null,
    "phoneNumberFilter": "1234567890"
}
Get All Stores
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getAll
Response:
[
    {
        "landmark": null,
        "district": null,
        "subDistrict": null,
        "managers": [],
        "latitude": 10.0,
        "longitude": -23.0,
        "intent": 3,
        "brandsInUse": [],
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "monthlySale": 230000.0,
        "brandProCons": [],
        "clientType": "shop",
        "totalVisitCount": 2,
        "visitThisMonth": 2,
        "lastVisitDate": null,
        "outcomeLastVisit": null,
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": null,
        "updatedTime": null,
        "storeId": 1,
        "storeName": "store1",
        "clientFirstName": "abcd",
        "clientLastName": "abcd",
        "primaryContact": 123456,
        "secondaryContact": 123456,
        "email": "abc@gmail.com",
        "industry": "industry2",
        "companySize": 55,
        "gstNumber": "gst12356",
        "addressLine1": "addressLine1",
        "addressLine2": "addressLine2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "likes": {}
    }
]


Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/edit?id=1

PayLoad:
{
    "clientLastName":"ABCD",
    "email":"abcd@gmail.com",
  "clientType": "Retail",
  "brandsInUse": ["Brand A", "Brand B", "Brand C"],
  "brandProsCons": [
    {
      "pros": "Great value for money",
      "cons": "Limited availability",
      "brand": "Brand A"
    },
    {
      "pros": "Wide variety",
      "cons": "Pricier than competitors",
      "brand": "Brand B"
    }
],
    "likes": 
{"cars": "tesla", 
"bikes":"BMW"
}
}
Success Response:
Store Updated Successfully
Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081:8081/store/deleteById?id=1
Success Response:
Store Data Deleted!
Add brands
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/edit?id=1
PayLoad:
{
  "brandsInUse": ["Brand A", "Brand B", "Brand C"],
}
Edit pros cons
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/editProCons?id=1

PayLoad:


[
    {
      "brandName": "Brand A",
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "cons": ["Con 1", "Con 2"]
    },
    {
      "brandName": "Brand D",
      "pros": ["Pro 10", "Pro 11"],
      "cons": ["Con 8", "Con 9"]
    }
  ]
Delete Pros Cons
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/deleteProCons?id=3
PayLoad:
[
    {
        "brandName":"Brand A"
    },
    {
	"brandName":"Brand B"
    }
]
Success Response:
Pros Cons Deleted Successfully!
Delete Likes
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/deleteLikes?id=2
PayLoad:
[
    {
        "likes":"bike"
    }
]
Success Response:
Likes Deleted Successfully!
Add Client Type
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/clientType/add
PayLoad:
{    
    "type":"B2B"
}
Get All Client Type
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/clientType/getAll
Response:
[
    {
        "id": 1,
        "type": "project"
    },
    {
        "id": 2,
        "type": "shop"
    }
]


Delete Client Type
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/clientType/delete?type=Project
Response:
Client type deleted successfully
Intent Audit Log
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/intent-audit/getAll
Response:
[
    {
        "id": 1,
        "storeId": 2,
        "storeName": "store2",
        "oldIntentLevel": 0,
        "newIntentLevel": 2,
        "employeeId": 1,
        "employeeName": "ShilpaK",
        "changeDate": "2024-03-12",
        "changeTime": "02:21:03"
    },
    {
        "id": 2,
        "storeId": 2,
        "storeName": "store2",
        "oldIntentLevel": 2,
        "newIntentLevel": 3,
        "employeeId": 1,
        "employeeName": "ShilpaK",
        "changeDate": "2024-03-12",
        "changeTime": "02:21:47"
    }
]
Get Intent Log By Store
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/intent-audit/getByStore?id=2
Response:
[
    {
        "id": 1,
        "storeId": 2,
        "storeName": "store2",
        "oldIntentLevel": 0,
        "newIntentLevel": 2,
        "employeeId": 1,
        "employeeName": "ShilpaK",
        "changeDate": "2024-03-12",
        "changeTime": "02:21:03"
    },
    {
        "id": 2,
        "storeId": 2,
        "storeName": "store2",
        "oldIntentLevel": 2,
        "newIntentLevel": 3,
        "employeeId": 1,
        "employeeName": "ShilpaK",
        "changeDate": "2024-03-12",
        "changeTime": "02:21:47"
    }
]
Get By Date Range & employee Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByDateRangeAndEmployee?id=1&start=2024-04-01&end=2024-05-15
Response:
[
    {
        "id": 1,
        "storeId": 1,
        "storeName": "store1",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "intent": 3,
        "storePrimaryContact": 123456,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-21",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": 10.0,
        "visitLongitude": -23.0,
        "checkinLatitude": 20.0,
        "checkinLongitude": -20.0,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": "2024-03-22",
        "checkoutDate": "2024-03-22",
        "checkinTime": "13:23:18.015",
        "checkoutTime": "13:33:34.323",
        "purpose": "Follow Up",
        "priority": "low",
        "outcome": "done",
        "feedback": null,
        "attachment": [],
        "attachmentResponse": [
            {
                "fileName": "Second.png",
                "fileDownloadUri": "http://localhost:8081/downloadFile/Second.png",
                "fileType": "image/png",
                "tag": "check-in",
                "size": 0
            }
        ],
        "visitIntentId": null,
        "visitIntentValue": null,
        "createdAt": "2024-03-22",
        "createdTime": "12:21:01.271",
        "updatedAt": "2024-03-22",
        "updatedTime": "12:21:01.271",
        "intentAuditLogDto": {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "oldIntentLevel": null,
            "newIntentLevel": 3,
            "employeeId": 1,
            "employeeName": "ShilpaK",
            "changeDate": "2024-03-21",
            "changeTime": "23:35:39.756",
            "visitId": null
        }
    },
    {
        "id": 2,
        "storeId": 1,
        "storeName": "store1",
        "storeLatitude": 10.0,
        "storeLongitude": -23.0,
        "intent": 3,
        "storePrimaryContact": 123456,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "visit_date": "2024-03-23",
        "scheduledStartTime": null,
        "scheduledEndTime": null,
        "visitLatitude": 10.0,
        "visitLongitude": -23.0,
        "checkinLatitude": null,
        "checkinLongitude": null,
        "checkoutLatitude": null,
        "checkoutLongitude": null,
        "checkinDate": null,
        "checkoutDate": null,
        "checkinTime": null,
        "checkoutTime": null,
        "purpose": "Follow Up",
        "priority": "low",
        "outcome": null,
        "feedback": null,
        "attachment": [],
        "attachmentResponse": [],
        "visitIntentId": null,
        "visitIntentValue": null,
        "createdAt": "2024-03-22",
        "createdTime": "12:21:17.22",
        "updatedAt": "2024-03-22",
        "updatedTime": "12:21:17.22",
        "intentAuditLogDto": {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "oldIntentLevel": null,
            "newIntentLevel": 3,
            "employeeId": 1,
            "employeeName": "ShilpaK",
            "changeDate": "2024-03-21",
            "changeTime": "23:35:39.756",
            "visitId": null
        }
    }
]
Get By Filters
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/filteredValues?storeName=Best%20Electronics&primaryContact=1234567890&ownerName=John%20Doe&city=San%20Francisco&state=California&monthlySale=50000.00&clientType=Retailer&page=0&size=10&sort=monthlySale,desc


ClientType Filter:
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/filteredValues?clientType=shop&page=0&size=10&sort=id,desc


Sorting using owner First name:
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/:8081/store/filteredValues?page=0&size=10&sort=ownerFirstName,asc


http://localhost:8081/store/filteredValues?page=0&size=10&sortBy=lastVisitDate&sortOrder=desc
http://localhost:8081/store/filteredValues?page=0&size=10&sortBy=visitCount&sortOrder=asc


Response:
[
    {
        "landmark": null,
        "district": null,
        "subDistrict": null,
        "managers": [],
        "latitude": 10.0,
        "longitude": -23.0,
        "intent": 3,
        "brandsInUse": [],
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "monthlySale": 230000.0,
        "brandProCons": [],
        "clientType": "shop",
        "totalVisitCount": 2,
        "visitThisMonth": 2,
        "lastVisitDate": "2024-04-13",
        "outcomeLastVisit": null,
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": null,
        "updatedTime": null,
        "storeId": 1,
        "storeName": "store1",
        "clientFirstName": "abcd",
        "clientLastName": "abcd",
        "primaryContact": 123456,
        "secondaryContact": 123456,
        "email": "abc@gmail.com",
        "industry": "industry2",
        "companySize": 55,
        "gstNumber": "gst12356",
        "addressLine1": "addressLine1",
        "addressLine2": "addressLine2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "likes": {}
    },
    {
        "landmark": null,
        "district": null,
        "subDistrict": null,
        "managers": [],
        "latitude": 10.0,
        "longitude": -23.0,
        "intent": null,
        "brandsInUse": [],
        "employeeId": 2,
        "employeeName": "Shubham T",
        "monthlySale": 230000.0,
        "brandProCons": [],
        "clientType": "shop",
        "totalVisitCount": 1,
        "visitThisMonth": 1,
        "lastVisitDate": "2024-04-13",
        "outcomeLastVisit": null,
        "createdAt": "2024-04-13",
        "updatedAt": "2024-04-13",
        "createdTime": null,
        "updatedTime": null,
        "storeId": 3,
        "storeName": "store3",
        "clientFirstName": "abcd",
        "clientLastName": "abcd",
        "primaryContact": 456,
        "secondaryContact": 123456,
        "email": "abc@gmail.com",
        "industry": "industry2",
        "companySize": 55,
        "gstNumber": "gst123586",
        "addressLine1": "addressLine1",
        "addressLine2": "addressLine2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "likes": {}
    }
]
Get All Store Names For An Employee
Get Call
(With pagination)
http://localhost:8081/store/getStoreNamesByEmployee?employeeId=1

(With Search term)
http://localhost:8081/store/getStoreNamesByEmployee?employeeId=1&searchTerm=e

(With search and sort)
https://api.gajkesaristeels.in/store/getStoreNamesByEmployee?employeeId=1&searchTerm=2&page=0&size=20&sortBy=storeName&sortOrder=desc

{
    "content": [
        {
            "id": 7,
            "storeName": "1"
        },
        {
            "id": 9,
            "storeName": "2"
        }
    ],
    "pageable": {
        "pageNumber": 0,
        "pageSize": 50,
        "sort": {
            "empty": false,
            "sorted": true,
            "unsorted": false
        },
        "offset": 0,
        "paged": true,
        "unpaged": false
    },
    "last": true,
    "totalElements": 11,
    "totalPages": 1,
    "size": 50,
    "number": 0,
    "sort": {
        "empty": false,
        "sorted": true,
        "unsorted": false
    },
    "first": true,
    "numberOfElements": 11,
    "empty": false
}

Get All Store Names
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/names
Response:
[
    {
        "id": 1,
        "storeName": "store1"
    },
    {
        "id": 3,
        "storeName": "store3"
    },
    {
        "id": 5,
        "storeName": "store3"
    },
    {
        "id": 7,
        "storeName": "1"
    },
    {
        "id": 9,
        "storeName": "2"
    },
    {
        "id": 10,
        "storeName": "3"
    },
    {
        "id": 11,
        "storeName": "4"
    },
    {
        "id": 13,
        "storeName": "5"
    },
    {
        "id": 14,
        "storeName": "6"
    },
    {
        "id": 18,
        "storeName": "store2"
    },
    {
        "id": 19,
        "storeName": "store2"
    },
    {
        "id": 20,
        "storeName": "store2"
    },
    {
        "id": 22,
        "storeName": "store2"
    }
]
Get Monthly Sale For Store
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/monthly-sale/getByStore?storeId=17
Response:
[
    {
        "id": 4,
        "storeId": 17,
        "storeName": "Jasraj",
        "oldMonthlySale": 5000.0,
        "newMonthlySale": 1000.0,
        "visitId": 612,
        "visitDate": "2024-05-18",
        "employeeId": 33,
        "employeeName": "Yash Puri",
        "changeDate": "2024-06-30",
        "changeTime": "21:02:32.824"
    }
 ]
Get By Employee(Pagination And Filter)
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByEmployeeNew?id=1&page=1&size=10

http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByEmployeeNew?id=1&page=0&size=10&storeName=ExampleStore&primaryContact=1234567890&ownerName=JohnDoe&city=ExampleCity&state=ExampleState&monthlySale=1000&clientType=Retail

http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByEmployeeWithSort?id=1&storeName=Example%20Store&sortBy=storeName&sortOrder=asc

Response:
{
    "content": [
        {
            "landmark": null,
            "district": null,
            "subDistrict": null,
            "managers": [],
            "latitude": 10.0,
            "longitude": -23.0,
            "intent": null,
            "brandsInUse": [],
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "monthlySale": 230000.0,
            "brandProCons": [],
            "clientType": "shop",
            "totalVisitCount": 0,
            "visitThisMonth": 0,
            "lastVisitDate": null,
            "outcomeLastVisit": null,
            "createdAt": "2024-05-09",
            "updatedAt": "2024-05-09",
            "createdTime": "14:32:21.285",
            "updatedTime": "14:32:21.285",
            "storeId": 22,
            "storeName": "store2",
            "clientFirstName": "abcd",
            "clientLastName": "abcd",
            "primaryContact": 13,
            "secondaryContact": 123456,
            "email": "abc@gmail.com",
            "industry": "industry2",
            "companySize": 78,
            "gstNumber": "gst134",
            "addressLine1": "addressLine1",
            "addressLine2": "addressLine2",
            "city": "Nagpur",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "likes": {}
        }
    ],
    "pageable": {
        "pageNumber": 1,
        "pageSize": 10,
        "sort": {
            "empty": true,
            "unsorted": true,
            "sorted": false
        },
        "offset": 10,
        "unpaged": false,
        "paged": true
    },
    "last": true,
    "totalElements": 11,
    "totalPages": 2,
    "first": false,
    "size": 10,
    "number": 1,
    "sort": {
        "empty": true,
        "unsorted": true,
        "sorted": false
    },
    "numberOfElements": 1,
    "empty": false
}

Get By Employee
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getByEmployee?id=1
Response:
[
    {
        "landmark": null,
        "district": null,
        "subDistrict": null,
        "managers": [],
        "latitude": 10.0,
        "longitude": -23.0,
        "intent": 3,
        "brandsInUse": [],
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "monthlySale": 230000.0,
        "brandProCons": [],
        "clientType": "shop",
        "totalVisitCount": 2,
        "visitThisMonth": 2,
        "lastVisitDate": null,
        "outcomeLastVisit": null,
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": null,
        "updatedTime": null,
        "storeId": 1,
        "storeName": "store1",
        "clientFirstName": "abcd",
        "clientLastName": "abcd",
        "primaryContact": 123456,
        "secondaryContact": 123456,
        "email": "abc@gmail.com",
        "industry": "industry2",
        "companySize": 55,
        "gstNumber": "gst12356",
        "addressLine1": "addressLine1",
        "addressLine2": "addressLine2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "likes": {}
    }
]
Get For Team
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getForTeam?teamId=6&page=1&size=10
Response:
{
    "content": [
        {
            "landmark": null,
            "district": null,
            "subDistrict": null,
            "managers": [],
            "latitude": 10.0,
            "longitude": -23.0,
            "intent": null,
            "brandsInUse": [],
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "monthlySale": 230000.0,
            "brandProCons": [],
            "clientType": "shop",
            "totalVisitCount": null,
            "visitThisMonth": null,
            "lastVisitDate": null,
            "outcomeLastVisit": null,
            "createdAt": "2024-05-09",
            "updatedAt": "2024-05-09",
            "createdTime": "14:32:21.285",
            "updatedTime": "14:32:21.285",
            "storeId": 22,
            "storeName": "store2",
            "clientFirstName": "abcd",
            "clientLastName": "abcd",
            "primaryContact": 13,
            "secondaryContact": 123456,
            "email": "abc@gmail.com",
            "industry": "industry2",
            "companySize": 78,
            "gstNumber": "gst134",
            "addressLine1": "addressLine1",
            "addressLine2": "addressLine2",
            "city": "Nagpur",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "likes": {}
        }
    ],
    "pageable": {
        "pageNumber": 1,
        "pageSize": 10,
        "sort": {
            "empty": true,
            "unsorted": true,
            "sorted": false
        },
        "offset": 10,
        "paged": true,
        "unpaged": false
    },
    "totalElements": 11,
    "totalPages": 2,
    "last": true,
    "size": 10,
    "number": 1,
    "sort": {
        "empty": true,
        "unsorted": true,
        "sorted": false
    },
    "numberOfElements": 1,
    "first": false,
    "empty": false
}
Get Phone Number for stores of an employee
Get Call
http://localhost:8081/store/getStorePhoneByEmployee?id=1
Response:
[
    {
        "storeId": 1,
        "phone": 123456
    }
]


Sales
Create
Post Call
http://localhost:8081/sales/create
PayLoad:
{
    "employeeId":1,
    "storeId": 1,
    "officeManagerId": 2,
    "tons":20
}
Response:
1


Get All
Get Call
http://localhost:8081/sales/getAll
Response:
[
    {
        "id": 1,
        "employeeId": 33,
        "employeeName": "Yash Puri",
        "officeManagerId": 86,
        "officeManagerName": "Test 1",
        "amount": null,
        "tons": 2.0,
        "storeId": 17,
        "storeName": "Jasraj",
        "storeCity": "Jalna ",
        "storeState": "Maharashtra",
        "createdAt": "2025-04-23",
        "createdTime": "21:35:45.706",
        "updatedAt": "2025-04-23",
        "updatedTime": "21:35:45.706"
    }
]


Get By Store
Get Call
http://localhost:8081/sales/getByStore?storeId=3


Get By Employee
Get Call
http://localhost:8081/sales/getByEmployee?employeeId=1
Get By Store and Date Range
Get Call
http://localhost:8081/sales/storeAndDateRange?storeId=1&startDate=2025-04-22&endDate=2025-04-23
Get By Employee and Date Range
Get Call
http://localhost:8081/sales/employeeAndDateRange?employeeId=1&startDate=2025-04-22&endDate=2025-04-23
Get Total Tons By Store
Get Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/sales/totalTonsByStore?storeId=17&startDate=2025-04-22&endDate=2025-04-23
Response:
{
    "employeeId": 33,
    "employeeName": "Yash Puri",
    "totalTons": 224.0,
    "storeId": 17,
    "storeName": "Jasraj"
}
Get Total Tons with Pagination
Get Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/sales/totalTons?startDate=2025-04-01&endDate=2025-04-30&page=0&size=10&storeId=17
Response:
{
    "content": [
        {
            "employeeId": 33,
            "employeeName": "Yash Puri",
            "totalTons": 458439.0,
            "storeId": 17,
            "storeName": "Jasraj",
            "storeCity": "Jalna ",
            "storeState": "Maharashtra"
        }
    ],
    "pageable": {
        "pageNumber": 0,
        "pageSize": 10,
        "sort": {
            "empty": false,
            "sorted": true,
            "unsorted": false
        },
        "offset": 0,
        "paged": true,
        "unpaged": false
    },
    "totalElements": 1,
    "totalPages": 1,
    "last": true,
    "size": 10,
    "number": 0,
    "sort": {
        "empty": false,
        "sorted": true,
        "unsorted": false
    },
    "numberOfElements": 1,
    "first": true,
    "empty": false
}
Get All Paginated WIth Filters
Get Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/sales/getFilteredSales?city=Jalna&storeId=17&employeeId=1&storeName=AAA&state=Maharashtra&size=0&page=0
Response:
{
    "content": [
        {
            "id": 10,
            "employeeId": 30,
            "employeeName": "Sachin Chavan",
            "officeManagerId": 86,
            "officeManagerName": "Test 1",
            "amount": null,
            "tons": 8888.0,
            "storeId": 6119,
            "storeName": " CA Satish Dakare ",
            "storeCity": "Kolhapur ",
            "storeState": "Maharashtra",
            "createdAt": "2025-04-28",
            "createdTime": "20:21:14.442",
            "updatedAt": "2025-04-28",
            "updatedTime": "20:21:14.442"
        }
    ],
    "pageable": {
        "pageNumber": 0,
        "pageSize": 10,
        "sort": {
            "empty": false,
            "sorted": true,
            "unsorted": false
        },
        "offset": 0,
        "paged": true,
        "unpaged": false
    },
    "totalElements": 10,
    "totalPages": 1,
    "last": true,
    "size": 10,
    "number": 0,
    "sort": {
        "empty": false,
        "sorted": true,
        "unsorted": false
    },
    "numberOfElements": 10,
    "first": true,
    "empty": false
}
NOTES
Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/edit?id=2
{
  "content": "Next Sample note content here.",
  "employeeId": 1,
  "storeId": 2
}
Response:
Notes updated Successfully!
Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/delete?id=3
Success Response:
Notes Deleted Successfully!
Create Note For Store
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/create
PayLoad:
{
  "id": 1,
  "content": "Sample note content here.",
  "employeeId": 1,
  "storeId": 2
}
Success Response(Notes Id):
2
Error Response:
Error Creating Note: Store NOt Found!
Error Response:
Error Creating Note: Employee NOt Found!
Create Note For a Visit
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/create
PayLoad:
{
  "content": "Sample note content here. 2",
  "employeeId": 2,
  "storeId": 1,
  "visitId":2
}
Success Response(Notes Id):
2
Error Response:
Error Creating Note: Store NOt Found!
Error Response:
Error Creating Note: Employee NOt Found!
Get All Notes
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/getAll
Response:
[
    {
        "id": 2,
        "content": "Sample note content here.",
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "storeId": 2,
        "storeName": "store2",
        "visitId": null,
        "createdDate": "2024-03-10",
        "updatedDate": "2024-03-10",
        "createdTime": null,
        "updatedTime": null
    }
]
Response with attachment:
[
    {
        "id": 1,
        "content": "Sample note content here. 2",
        "employeeId": 2,
        "employeeName": "Shubham T",
        "storeId": 1,
        "storeName": "store1",
        "visitId": 2,
        "attachment": [],
        "attachmentResponse": [
            {
                "fileName": "Code.JPG",
                "fileDownloadUri": "http://localhost:8081/downloadFile/Code.JPG",
                "fileType": "image/jpeg",
                "tag": "check-in",
                "size": 0
            }
        ],
        "createdDate": "2024-03-26",
        "updatedDate": "2024-03-26",
        "createdTime": "15:29:41.036",
        "updatedTime": "15:29:41.036"
    }
]


Get All For a store
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/getByStore?id=2
Response:
[
    {
        "id": 2,
        "content": "Sample note content here.",
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "storeId": 2,
        "storeName": "store2",
        "visitId": null,
        "createdDate": "2024-03-10",
        "updatedDate": "2024-03-10",
        "createdTime": null,
        "updatedTime": null
    }
]
Add Attachment
Tag value(check-in/ check-out)
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/uploadFile?id=1&tag=check-in
Response:
PayLoad:
File
Response(Notes Id):
1
Delete Attachment
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/removeFile?id=1
PayLoad:
{
    "ids":[
        3
    ]
}
Response:
Attachments deleted successfully from the notes.
Get Attachment
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/getFiles?id=1
Response:
[
    "/notes/images/1/0"
]
Get By Visit
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/getByVisit?id=893
Response:
[
    {
        "id": 178,
        "content": "test",
        "employeeId": 33,
        "employeeName": "Yash Puri",
        "storeId": 17,
        "storeName": "Jasraj",
        "visitId": 893,
        "attachment": [],
        "attachmentResponse": [],
        "createdDate": "2024-07-01",
        "updatedDate": "2024-07-01",
        "createdTime": "19:49:07.293",
        "updatedTime": "19:49:07.294"
    },
    {
        "id": 179,
        "content": "test2",
        "employeeId": 33,
        "employeeName": "Yash Puri",
        "storeId": 17,
        "storeName": "Jasraj",
        "visitId": 893,
        "attachment": [],
        "attachmentResponse": [],
        "createdDate": "2024-07-01",
        "updatedDate": "2024-07-01",
        "createdTime": "19:53:41.682",
        "updatedTime": "19:53:41.682"
    }
]
Image Link
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/images/1/0

EMPLOYEE
Create
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/add
PayLoad:
{
    "firstName":"Shilpa",
    "lastName":"K",
    "employeeId":"E101",
    "primaryContact":9892868637,
    "secondaryContact":8104846414,
    "departmentName":"Sales",    
    "email":"s@k.com",
    "role":"Field Officer",
    "addressLine1":"address1",
    "addressLine2":"address2",
    "city":"Mumbai",
    "state":"Maharashtra",
    "country":"India",
    "pincode":410206,
    "dateOfJoining":"2017-01-12"
}
Success Response:
Employee saved!
Error Response:
Error Creating Employee: Department Not Found!
Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/edit?empId=E102
PayLoad(Pass the new values for fields):
{
    "role":"Field Manager"
}

Success Response:
Employee updated!
Edit House Location
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/edit?empId=E102
PayLoad:
{
    "houseLatitude":10.8,
    "houseLongitude":10.5
}

Delete
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/delete?id=2
Response:
Employee Deleted Successfully!
Get By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getById?id=2

Response:
{
    "id": 1,
    "firstName": "Shilpa",
    "lastName": "K",
    "employeeId": "E101",
    "primaryContact": 9892868637,
    "secondaryContact": 8104846414,
    "departmentName": "Sales",
    "email": "s@k.com",
    "role": "Field Officer",
    "addressLine1": "address1",
    "addressLine2": "address2",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pincode": 410206,
"houseLatitude":10.8,
    "houseLongitude":10.5
    "dateOfJoining": "2017-01-12",
    "userDto": {
        "username": "Shilpa",
        "password": null,
        "roles": null,
        "employeeId": null,
        "firstName": null,
        "lastName": null
    },
    "createdAt": "2024-03-21",
    "updatedAt": "2024-03-21",
    "createdTime": "23:19:26.173",
    "updatedTime": "23:19:26.173",
    "companyId": null,
    "companyName": null
}



Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getAll
Response:
[
    {
        "id": 1,
        "firstName": "Shilpa",
        "lastName": "K",
        "employeeId": "E101",
        "primaryContact": 9892868637,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "createdAt": "2024-03-08",
        "updatedAt": "2024-03-08",
"userDto": {
        "username": "Shilpa",
        "password": null,
        "roles": null,
        "employeeId": null,
        "firstName": null,
        "lastName": null
    },


    },
    {
        "id": 7,
        "firstName": "Manager",
        "lastName": "1",
        "employeeId": "E106",
        "primaryContact": 8080,
        "secondaryContact": 8104846414,
        "status": null,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Manager",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "userDto": {
            "username": "Abc",
            "password": null,
            "plainPassword": "Abc123",
            "roles": null,
            "employeeId": null,
            "firstName": null,
            "lastName": null
        },
        "teamId": null,
        "isOfficeManager": true,
        "assignedCity": [
            "Nagpur",
            "Mumbai"
        ],
        "travelAllowance": null,
        "dearnessAllowance": null,
        "createdAt": "2024-06-28",
        "updatedAt": "2024-06-28",
        "createdTime": "11:57:32.799",
        "updatedTime": "11:57:32.799",
        "companyId": null,
        "companyName": null,
        "fullMonthSalary": null
    }
]
Designation add
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/designation/add
PayLoad:
{
    "designation":"Manager"
}
Response:
Designation Stored Successfully!

Designation edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/designation/edit
PayLoad:
{
    "oldDesignation":"Manager",
    "newDesignation":"manager"
}
Response:
Designation updated!

Designation delete
Delete
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/designation/delete?name=Managers
Response:
Designation Deleted!
Designation get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/designation/getAll
Response:
[
    {
        "id": 1,
        "designation": "field officer"
    },
    {
        "id": 2,
        "designation": "office manager"
    },
    {
        "id": 3,
        "designation": "manager"
    }
]
Get By Role
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getByRole?role=Office%20Manager
Response:
[
    {
        "id": 86,
        "firstName": "Test",
        "lastName": "1",
        "employeeId": "E1",
        "primaryContact": 123,
        "secondaryContact": 123,
        "status": null,
        "departmentName": "Sales",
        "email": "t@1.com",
        "role": "Office Manager",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Benagluru",
        "state": "Karnataka",
        "country": "India",
        "pincode": 560076,
        "dateOfJoining": "2017-01-12",
        "userDto": null,
        "teamId": null,
        "isOfficeManager": false,
        "assignedCity": null,
        "travelAllowance": null,
        "dearnessAllowance": null,
        "createdAt": "2024-05-17",
        "updatedAt": "2024-05-17",
        "createdTime": "23:57:00.19",
        "updatedTime": "23:57:00.19",
        "companyId": null,
        "companyName": null,
        "fullMonthSalary": null
    }
]


Get All Office Managers
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getOfficeManager
Response:
[
    {
        "id": 86,
        "firstName": "Test",
        "lastName": "1",
        "employeeId": "E1",
        "primaryContact": 123,
        "secondaryContact": 123,
        "departmentName": "Sales",
        "email": "t@1.com",
        "role": "Office Manager",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Benagluru",
        "state": "Karnataka",
        "country": "India",
        "pincode": 560076,
        "dateOfJoining": "2017-01-12",
        "userDto": null,
        "teamId": 1,
        "isOfficeManager": true,
        "assignedCity": null,
        "travelAllowance": null,
        "dearnessAllowance": null,
        "createdAt": "2024-05-17",
        "updatedAt": "2024-05-17",
        "createdTime": "23:57:00.19",
        "updatedTime": "23:57:00.19",
        "companyId": null,
        "companyName": null,
        "fullMonthSalary": null
    }
]

Get All Field Officers
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getFieldOfficer
Response:
[
    {
        "id": 1,
        "firstName": "Shilpa",
        "lastName": "K",
        "employeeId": "E101",
        "primaryContact": 9892868637,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": "23:19:26.173",
        "updatedTime": "23:19:26.173",
        "companyId": null,
        "companyName": null
    },
    {
        "id": 3,
        "firstName": "Jyoti",
        "lastName": "T",
        "employeeId": "E101",
        "primaryContact": 8080830803,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "createdAt": "2024-04-13",
        "updatedAt": "2024-04-13",
        "createdTime": "14:28:18.249",
        "updatedTime": "14:28:18.249",
        "companyId": null,
        "companyName": null
    }
]
Get Unique Cities
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getCities
Response:
[
    "Jalna",
    "Mumbai"
]
Set Inactive
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/setInactive?id=3
Response:
Employee Status changed!
Set Active
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/setActive?id=3
Response:
Employee Status changed!
Get All Inactive Employee(Archived)
Get Call
http://localhost:8081/employee/getAllInactive
Response:
[
    {
        "id": 3,
        "firstName": "Jyoti",
        "lastName": "T",
        "employeeId": "E101",
        "primaryContact": 8080830803,
        "secondaryContact": 8104846414,
        "status": "inactive",
        "houseLatitude": null,
        "houseLongitude": null,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "userDto": {
            "username": "Jyoti",
            "password": null,
            "plainPassword": "Jyoti123",
            "roles": null,
            "employeeId": null,
            "firstName": null,
            "lastName": null
        },
        "teamId": null,
        "isOfficeManager": false,
        "assignedCity": [],
        "travelAllowance": null,
        "dearnessAllowance": null,
        "createdAt": "2024-04-13",
        "updatedAt": "2024-04-13",
        "createdTime": "14:28:18.249",
        "updatedTime": "14:28:18.249",
        "companyId": null,
        "companyName": null,
        "fullMonthSalary": null
    }
]
Remove Assigned City
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/removeAssignedCity?employeeId=7&city=Jalna
Response:
Jalna removed from Employee Id: 7 and associated team updated/deleted.

Get Traveled Distance
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getTravelledDistance?id=1&date=2024-03-22
Response:
6838.31564087652
Update Live Location
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/updateLiveLocation?id=1&latitude=12.2&longitude=13.9
Response:
Location Updated!
Get Live Location
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getLiveLocation?id=1
Response:
{
    "id": 1,
    "empId": 1,
    "empName": "Shilpa K",
    "latitude": 12.2,
    "longitude": 13.9,
    "updatedAt": "2024-07-18",
    "updatedTime": "12:58:02.793"
}
Set employee Salary
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/setSalary
PayLoad:
{
    "travelAllowance":100,
    "dearnessAllowance":100,
    "fullMonthSalary":5000,
    "employeeId":1 
}
Response:
Salary Updated!
Edit Username
Put Call
http://ec2-13-48-72-129.eu-north-1.compute.amazonaws.com:8081/employee/editUsername?id=1&username=newUsername
Response:
Username Updated!

Create Attendance Log For Employee
Post Call
http://ec2-13-48-72-129.eu-north-1.compute.amazonaws.com:8081/attendance-log/createAttendanceLog?employeeId=255
Response:
Attendance log created successfully for Bhushan  Kharat for today.
Attendance Rule
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-rule/getAll
Response:
[
    {
        "id": 1,
        "rule": "check in - check out",
        "halfDayCount": null,
        "fullDayCount": null
    },
    {
        "id": 2,
        "rule": "visit count",
        "halfDayCount": 2,
        "fullDayCount": 4
    }
]
Get By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-rule/getById?id=2
Response:
{
    "id": 2,
    "rule": "visit count",
    "halfDayCount": 2,
    "fullDayCount": 4
}
Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-rule/edit?id=2
PayLoad:
{
    "fullDayCount":5,
    "HalfDayCount":3
}
Response:
Rule Updated Successfully!
Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-rule/create
PayLoad:
{
    "rule":"unknown",
    "fullDayCount":5,
    "HalfDayCount":3
}
Response:
3
Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-rule/delete?id=3
Response:
Rule Deleted!
Error Response:
Error Deleting Rule: Rule Not Found!
Attendance Log
Create
Post Call
http://ec2-13-48-72-129.eu-north-1.compute.amazonaws.com:8081/attendance-log/createAttendanceLog?employeeId=229
Response:
Attendance log created successfully for Yokesh Bhatt for today.
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/getAll
Response:
[
    [
    {
        "id": 1,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "attendanceStatus": "Present",
        "visitCount": 1,
        "uniqueStoreCount": null,
        "travelAllowance": null,
        "dearnessAllowance": null,
        "vehicleType": "Car",
        "isDefault": false,
        "checkinDate": "2024-03-22",
        "checkoutDate": "2024-03-22",
        "checkinTime": "13:23:18.179",
        "checkoutTime": "13:33:34.426",
        "pricePerKmCar": null,
        "pricePerKmBike": null,
        "fullMonthSalary": null
    }
]
Get All By Date Range
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/getForRange1?start=2024-03-01&end=2024-05-31
Response:
[
    {
        "id": 1,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "attendanceStatus": "Present",
        "visitCount": 1,
        "uniqueStoreCount": null,
        "travelAllowance": null,
        "dearnessAllowance": null,
        "checkinDate": "2024-03-22",
        "checkoutDate": "2024-03-22",
        "checkinTime": "13:23:18.179",
        "checkoutTime": "13:33:34.426",
        "fullMonthSalary": null
    },
    {
        "id": 9,
        "employeeId": 2,
        "employeeName": "Shubham T",
        "attendanceStatus": "Present",
        "visitCount": 1,
        "uniqueStoreCount": null,
        "travelAllowance": null,
        "dearnessAllowance": null,
        "checkinDate": "2024-04-13",
        "checkoutDate": "2024-04-13",
        "checkinTime": "12:48:53.841",
        "checkoutTime": "13:04:19.151",
        "fullMonthSalary": null
    }
]


Get By Date
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/getByDate?date=2024-03-22
Response:
[
    {
        "id": 1,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "attendanceStatus": null,
        "visitCount": 1,
        “vehicleType”:”car”,
        "checkinDate": "2024-03-22",
        "checkoutDate": null,
        "checkinTime": "13:23:18.179",
        "checkoutTime": null
    }
]
Get By Date Range for employee(Weekly)
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/weeklyVisits?date=2024-05-01&employeeId=85

Response:
{
    "weeklyCount": 6,
    "monthlyCount": null,
    "yearlyCount": null,
    "uniqueStoreCount": 22,
    "fullDays": null,
    "halfDays": null,
    "absences": null,
    "statsDto": {
        "visitCount": 6,
        "fullDays": 5,
        "halfDays": 0,
        "absences": 1
    }
}
Get By Date Range for employee(Monthly)
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/monthlyVisits?date=2024-05-01&employeeId=85
Response:
{
    "weeklyCount": null,
    "monthlyCount": 18,
    "yearlyCount": null,
    "uniqueStoreCount": 4,
    "fullDays": null,
    "halfDays": null,
    "absences": null,
    "statsDto": {
        "visitCount": 18,
        "fullDays": 0,
        "halfDays": 4,
        "absences": 13
    }
}


Get By Date Range for employee(Yearly)
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/yearlyVisits?date=2024-05-01&employeeId=85
Response:
{
    "weeklyCount": null,
    "monthlyCount": null,
    "yearlyCount": 19,
    "uniqueStoreCount": 34,
    "fullDays": null,
    "halfDays": null,
    "absences": null,
    "statsDto": {
        "visitCount": 19,
        "fullDays": 10,
        "halfDays": 1,
        "absences": 8
    }
}



Get By Date Range For all employee
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/dateRangeCount?start=2024-04-01&end=2024-05-25

Get By Date Range
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/getForRange?start=2024-03-21&end=2024-03-22
Response:
[
 {
        "weeklyCount": null,
        "monthlyCount": null,
        "yearlyCount": null,
        "uniqueStoreCount": 0,
        "fullDays": 0,
        "halfDays": 0,
        "absences": 0,
        "travelAllowance": 0.0,
        "dearnessAllowance": 0.0,
        "salary": 5000.0,
        "statsDto": {
            "visitCount": 1,
            "fullDays": 0,
            "halfDays": 0,
            "absences": 0
        },
        "employeeId": 1,
        "employeeFirstName": "Shilpa",
        "employeeLastName": "K"
    }
]
Delete Duplicate Records for an employee
Delete Call
http://localhost:8081/attendance-log/deleteLog?employeeId=1&date=2024-11-27
Response:
Log Deleted!


Delete duplicate logs for a date range
Post Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/attendance-log/cleanup?startDate=2025-02-11&endDate=2025-02-11




EXPENSE TYPE
Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense-type/create
PayLoad:
{
    "type":"travel",
    "subType": ["Car", "Bike"]
}
Response:
2
PayLoad:
{
    "type":"food"
}
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense-type/getAll
Response:
[
    {
        "id": 1,
        "type": "travel",
        "subType": [
            "Car",
            "Bike"
        ]
    },
    {
        "id": 2,
        "type": "food",
        "subType": []
    },
    {
        "id": 3,
        "type": "accomodation",accommodation
        "subType": []
    },
    {
        "id": 4,
        "type": "other",
        "subType": []
    }
]
Get By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense-type/getById?id=2
Response:
{
    "id": 2,
    "type": "travel",
    "subType": [
        "Car",
        "Bike"
    ]
}
Remove SubType
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense-type/removeSubType?id=2&type=Car
Response:
SubType removed Successfully!
EXPENSE
Get For Date Range For All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/getByDateRange?start=2024-03-01&end=2024-03-30
Response:
[
    {
        "id": 1,
        "type": "travel",
        "subType": "bike",
        "amount": 300.0,
        "approvalPersonId": 2,
        "approvalPersonName": "Shubham T",
        "approvalStatus": "Rejected",
        "description": "desc",
        "approvalDate": "2024-03-26",
        "submissionDate": null,
        "rejectionReason": "Reason",
        "reimbursedDate": "2023-03-23",
        "reimbursementAmount": 201.0,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "expenseDate": "2024-03-21",
        "paymentMethod": null,
        "attachment": [],
        "attachmentResponse": []
    }
]
Date Range For An Employee
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/getByEmployeeAndDate?start=2024-03-01&end=2024-03-30&id=1
Response:
[
    {
        "id": 1,
        "type": "travel",
        "subType": "bike",
        "amount": 300.0,
        "approvalPersonId": 2,
        "approvalPersonName": "Shubham T",
        "approvalStatus": "Rejected",
        "description": "desc",
        "approvalDate": "2024-03-26",
        "submissionDate": null,
        "rejectionReason": "Reason",
        "reimbursedDate": "2023-03-23",
        "reimbursementAmount": 201.0,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "expenseDate": "2024-03-21",
        "paymentMethod": null,
        "attachment": [],
        "attachmentResponse": []
    }
]
Reject Multiple For An Employee
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/rejectMultiple
PayLoad:
[
    {
        "id":1,
         "approvalStatus":"Rejected",
        "approvalDate":"2024-03-26",
        "rejectionReason":"Reason"
    },
    {
        "id":3,
         "approvalStatus":"Rejected",
        "approvalDate":"2024-03-26",
        "rejectionReason":"Reason"
    }


]
Response:
Rejected!
Accept Multiple for an employee
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/approveMultiple
PayLoad:
[
    {
        "id":1,
        "approvalStatus":"Approved",
        "approvalDate":"2024-03-23",
        "reimbursedDate":"2023-03-23",
        "reimbursementAmount":201,
        "paymentMethod":"cash"
    },
    {
        "id":3,
        "approvalStatus":"Approved",
        "approvalDate":"2024-03-23",
        "reimbursedDate":"2023-03-23",
        "reimbursementAmount":100,
        "paymentMethod":"upi"
    }


]
Response:
Approved!
Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/create
PayLoad:
{
    "type":"travel",
    "subType":"bike",
    "amount":200,
    "description":"desc",
    "employeeId":1,
    "expenseDate":"2024-03-21"
}
Response:
1



Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/getAll
Response:
[
    {
        "id": 1,
        "type": "travel",
        "subType": "bike",
        "amount": 200.0,
        "approvalPersonId": 2,
        "approvalPersonName": "Shubham T",
        "approvalStatus": "Pending",
        "description": "desc",
        "approvalDate": null,
        "submissionDate": null,
        "rejectionReason": null,
        "reimbursedDate": null,
        "reimbursementAmount": null,
        "employeeId": null,
        "employeeName": null,
        "expenseDate": "2024-03-21",
        "paymentMethod": null
    }
]
Response with Attachment:
[
    {
        "id": 1,
        "type": "travel",
        "subType": "bike",
        "amount": 300.0,
        "approvalPersonId": 2,
        "approvalPersonName": "Shubham T",
        "approvalStatus": "Rejected",
        "description": "desc",
        "approvalDate": "2024-03-22",
        "submissionDate": null,
        "rejectionReason": "Reason",
        "reimbursedDate": "2023-03-23",
        "reimbursementAmount": 200.0,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "expenseDate": "2024-03-21",
        "paymentMethod": null,
        "attachment": [],
        "attachmentResponse": [
            {
                "fileName": "Exception-Handling-768.png",
                "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                "fileType": "image/png",
                "tag": "check-in",
                "size": 0
            },
            {
                "fileName": "Exception-Handling-768.png",
                "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                "fileType": "image/png",
                "tag": "check-out",
                "size": 0
            }
        ]
    },
    {
        "id": 3,
        "type": "food",
        "subType": null,
        "amount": 200.0,
        "approvalPersonId": 2,
        "approvalPersonName": "Shubham T",
        "approvalStatus": "Pending",
        "description": "desc",
        "approvalDate": null,
        "submissionDate": null,
        "rejectionReason": null,
        "reimbursedDate": null,
        "reimbursementAmount": null,
        "employeeId": 2,
        "employeeName": "Shubham T",
        "expenseDate": "2024-03-19",
        "paymentMethod": null,
        "attachment": [],
        "attachmentResponse": []
    }
]
Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/edit?id=1
PayLoad:
{
    "amount":300,
    "expenseDate":"2024-03-21"
}

Response:
Expense Saved Successfully!
Approve
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/updateApproval?id=1
PayLoad:

{


    "approvalStatus":"Approved",
    "approvalDate":"2024-03-23",
    "reimbursedDate":"2023-03-23",
    "reimbursementAmount":200,
    "paymentMethod":"cash"
}
Response:
Approved!
Reject
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/reject?id=1
PayLoad:
{


    "approvalStatus":"Rejected",
    "approvalDate":"2024-03-22",
    "rejectionReason":"Reason"
}
Response:
Rejected!
Get by Employee
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/getById?id=1
Response:
[
    {
        "id": 1,
        "type": "travel",
        "subType": "bike",
        "amount": 300.0,
        "approvalPersonId": 2,
        "approvalPersonName": "Shubham T",
        "approvalStatus": "Rejected",
        "description": "desc",
        "approvalDate": "2024-03-22",
        "submissionDate": null,
        "rejectionReason": "Reason",
        "reimbursedDate": "2023-03-23",
        "reimbursementAmount": 200.0,
        "employeeId": null,
        "employeeName": null,
        "expenseDate": "2024-03-21",
        "paymentMethod": null
    },
    {
        "id": 2,
        "type": "food",
        "subType": null,
        "amount": 150.0,
        "approvalPersonId": 2,
        "approvalPersonName": "Shubham T",
        "approvalStatus": "Pending",
        "description": "desc",
        "approvalDate": null,
        "submissionDate": null,
        "rejectionReason": null,
        "reimbursedDate": null,
        "reimbursementAmount": null,
        "employeeId": null,
        "employeeName": null,
        "expenseDate": "2024-03-15",
        "paymentMethod": null
    }
]

Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/delete?id=1
Response:
Expense Deleted!
Add Attachment
Tag value(check-in/ check-out)
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/uploadFile?id=1&tag=check-in
Response:
PayLoad:
File
Response(Expense Id):
1
Delete Attachment
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/removeFile?id=1
PayLoad:
{
    "ids":[
        3
    ]
}
Response:
Attachments deleted successfully from the expense.
Get Attachment
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/getFiles?id=1
Response:
[
    "/expense/images/1/0"
]
Image Link
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/images/1/0
EMPLOYEE LOGIN
Create(Nested)
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee-user/create
PayLoad:
{
  "user": {
    "username":"Jyoti",
    "password":"Jyoti123"
  },
  "employee": {
    "firstName":"Jyoti",
    "lastName":"T",
    "employeeId":"E101",
    "primaryContact":8080830803,
    "secondaryContact":8104846414,
    "departmentName":"Sales",    
    "email":"s@k.com",
    "role":"Field Officer",
    "addressLine1":"address1",
    "addressLine2":"address2",
    "city":"Mumbai",
    "state":"Maharashtra",
    "country":"India",
    "pincode":410206,
    "dateOfJoining":"2017-01-12"
  }
}
Response:
User Created! 3

Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/manage/create
PayLoad:
{
    "username":"Shilpa",
    "password":"Shilpa123",
    "employeeId":1


}
Response:
Shilpa FIELD OFFICERSaved!
Update
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/manage/update
PayLoad:
{
    "username":"Prisha",
    "password":"Prisha1234"
}
Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/manage/delete?username=Shilpa
Response:
Shilpadeleted!
Get
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/manage/get?username=Shilpa
Response:
{
    "username": "Shilpa",
    "password": null,
    "roles": "FIELD OFFICER",
    "employeeId": 1,
    "firstName": "Shilpa",
    "lastName": "K"
}
Current User
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/manage/current-user
Response:
{
    "password": "$2a$10$AUTUHmCXqJ1FVpPCnKccveBcG9PDWdp7Mj0ROPtXZwJSfB0kJO4x.",
    "username": "Yash123",
    "authorities": [
        {
            "authority": "ROLE_FIELD OFFICER"
        }
    ],
    "accountNonExpired": true,
    "accountNonLocked": true,
    "credentialsNonExpired": true,
    "enabled": true
}
2. {
    "password": "$2a$10$gbfaYtF5SNpVHHS/WjYSS.Wzp9GQnYKqHmNZB7r8Pgki3t0Jq1a.e",
    "username": "admin_gajkesari",
    "authorities": [
        {
            "authority": "ROLE_ADMIN"
        }
    ],
    "accountNonExpired": true,
    "accountNonLocked": true,
    "credentialsNonExpired": true,
    "enabled": true
}

TEAM
Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/create
PayLoad:
{
    "officeManager":2,
    "fieldOfficers": [1]
}
Response:
1
Delete Team
Delete Call
http:/ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/delete?id=3
Response:
Team Deleted Successfully!
Edit Office Manager
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/editOfficeManager?id=6
PayLoad:
{
    "officeManager":6
}
Response:
Office Manager Added Successfully!
Delete Field Officer From Team
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/deleteFieldOfficer?id=6
PayLoad:
{
    "fieldOfficers": [6]
}


Response:
Field Officer Removed From Team Successfully!
Add Field Officer to the Team
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/addFieldOfficer?id=6
PayLoad:
{
    "fieldOfficers": [1]
}
Response:
Field Officer Added Successfully!
Get All
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/getAll
Get Call
Response:[
    {
        "id": 1,
        "officeManager": {
            "id": 86,
            "firstName": "Test",
            "lastName": "1",
            "employeeId": "E1",
            "primaryContact": 123,
            "secondaryContact": 123,
            "departmentName": "Sales",
            "email": "t@1.com",
            "role": "Office Manager",
            "addressLine1": "address1",
            "addressLine2": "address2",
            "city": "Benagluru",
            "state": "Karnataka",
            "country": "India",
            "pincode": 560076,
            "dateOfJoining": "2017-01-12",
            "userDto": null,
            "createdAt": "2024-05-17",
            "updatedAt": "2024-05-17",
            "createdTime": "23:57:00.19",
            "updatedTime": "23:57:00.19",
            "companyId": null,
            "companyName": null
        },
        "fieldOfficers": [
            {
                "id": 33,
                "firstName": "Yash",
                "lastName": "Puri",
                "employeeId": "",
                "primaryContact": 9765723830,
                "secondaryContact": null,
                "departmentName": "Sales",
                "email": "yashmitian@gmail.com",
                "role": "Field Officer",
                "addressLine1": "23, Maa, behind funskool",
                "addressLine2": "Near azad maidan",
                "city": "Jalna",
                "state": "Maharashtra",
                "country": "India",
                "pincode": 421203,
                "dateOfJoining": null,
                "userDto": {
                    "username": "Yash123",
                    "password": null,
                    "plainPassword": null,
                    "roles": null,
                    "employeeId": null,
                    "firstName": null,
                    "lastName": null
                },
                "createdAt": "2024-04-26",
                "updatedAt": "2024-04-26",
                "createdTime": "06:16:19.323",
                "updatedTime": "06:16:19.323",
                "companyId": null,
                "companyName": null
            },
            {
                "id": 86,
                "firstName": "Test",
                "lastName": "1",
                "employeeId": "E1",
                "primaryContact": 123,
                "secondaryContact": 123,
                "departmentName": "Sales",
                "email": "t@1.com",
                "role": "Office Manager",
                "addressLine1": "address1",
                "addressLine2": "address2",
                "city": "Benagluru",
                "state": "Karnataka",
                "country": "India",
                "pincode": 560076,
                "dateOfJoining": "2017-01-12",
                "userDto": null,
                "createdAt": "2024-05-17",
                "updatedAt": "2024-05-17",
                "createdTime": "23:57:00.19",
                "updatedTime": "23:57:00.19",
                "companyId": null,
                "companyName": null
            }
        ]
    }
]
Get By Office Manager
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/getbyEmployee?id=1
Response:
[
    {
        "id": 1,
        "officeManager": {
            "id": 2,
            "firstName": "Shubham",
            "lastName": "T",
            "employeeId": "E102",
            "primaryContact": 7977953937,
            "secondaryContact": null,
            "departmentName": "Sales",
            "email": "s@k.com",
            "role": "Office Manager",
            "addressLine1": "address1",
            "addressLine2": "address2",
            "city": "Mumbai",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "dateOfJoining": "2017-01-20",
            "userDto": null,
            "teamId": 1,
            "isOfficeManager": true,
            "assignedCity": "Mumbai",
            "travelAllowance": null,
            "dearnessAllowance": null,
            "createdAt": "2024-03-22",
            "updatedAt": "2024-03-22",
            "createdTime": "21:23:51.782",
            "updatedTime": "21:23:51.782",
            "companyId": null,
            "companyName": null,
            "fullMonthSalary": null
        },
        "fieldOfficers": []
    }
]

Get By Id
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/getById?id=1
Get Mapping

[
    {
        "id": null,
        "officeManager": {
            "id": 2,
            "firstName": "Shubham",
            "lastName": "T",
            "employeeId": "E102",
            "primaryContact": 7977953937,
            "secondaryContact": null,
            "departmentName": "Sales",
            "email": "s@k.com",
            "role": "Office Manager",
            "addressLine1": "address1",
            "addressLine2": "address2",
            "city": "Mumbai",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "dateOfJoining": "2017-01-20",
            "createdAt": "2024-03-22",
            "updatedAt": "2024-03-22",
            "createdTime": "21:23:51.782",
            "updatedTime": "21:23:51.782"
        },
        "fieldOfficers": [
            {
                "id": 2,
                "firstName": "Shubham",
                "lastName": "T",
                "employeeId": "E102",
                "primaryContact": 7977953937,
                "secondaryContact": null,
                "departmentName": "Sales",
                "email": "s@k.com",
                "role": "Office Manager",
                "addressLine1": "address1",
                "addressLine2": "address2",
                "city": "Mumbai",
                "state": "Maharashtra",
                "country": "India",
                "pincode": 410206,
                "dateOfJoining": "2017-01-20",
                "createdAt": "2024-03-22",
                "updatedAt": "2024-03-22",
                "createdTime": "21:23:51.782",
                "updatedTime": "21:23:51.782"
            },
            {
                "id": 1,
                "firstName": "Shilpa",
                "lastName": "K",
                "employeeId": "E101",
                "primaryContact": 9892868637,
                "secondaryContact": 8104846414,
                "departmentName": "Sales",
                "email": "s@k.com",
                "role": "Field Officer",
                "addressLine1": "address1",
                "addressLine2": "address2",
                "city": "Mumbai",
                "state": "Maharashtra",
                "country": "India",
                "pincode": 410206,
                "dateOfJoining": "2017-01-12",
                "createdAt": "2024-03-21",
                "updatedAt": "2024-03-21",
                "createdTime": "23:19:26.173",
                "updatedTime": "23:19:26.173"
            }
        ]
    }
]
Get Expense For a Team
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/getForTeam?id=6
Response:
[
    {
        "id": 1,
        "type": "travel",
        "subType": "bike",
        "amount": 300.0,
        "approvalPersonId": 2,
        "approvalPersonName": "Shubham T",
        "approvalStatus": "Rejected",
        "description": "desc",
        "approvalDate": "2024-03-26",
        "submissionDate": null,
        "rejectionReason": "Reason",
        "reimbursedDate": "2023-03-23",
        "reimbursementAmount": 201.0,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "expenseDate": "2024-03-21",
        "paymentMethod": null,
        "attachment": [],
        "attachmentResponse": []
    }
]
Get Visits For A Team
Get Tasks For A Team



COMPANY
Create
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/company/create
PayLoad:
{
  "companyName": "Gajkesari",
  "ownerFirstName": "John",
  "ownerLastName": "Doe",
  "primaryContact": 1234567890,
  "secondaryContact": 9876543210,
  "email": "gajkesari@example.com",
  "industry": "Steel",
  "companySize": 100,
  "gstNumber": "GST123456789",
  "addressLine1": "123 Example Street",
  "addressLine2": "Apt 101",
  "city": "Jalna",
  "state": "Maharashtra",
  "country": "India",
  "pincode": 12345
}
Response:
1
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/company/getAll
Response:
[
    {
        "id": null,
        "companyName": "Gajkesari",
        "ownerFirstName": "John",
        "ownerLastName": "Doe",
        "primaryContact": 1234567890,
        "secondaryContact": 9876543210,
        "email": "gajkesari@example.com",
        "industry": "Steel",
        "companySize": 100,
        "gstNumber": "GST123456789",
        "addressLine1": "123 Example Street",
        "addressLine2": "Apt 101",
        "city": "Jalna",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 12345,
        "createdAt": "2024-03-20",
        "updatedAt": "2024-03-20",
        "createdTime": "12:32:49.115",
        "updatedTime": "12:32:49.116",
        "subscriptionType": "Annually",
        "subscriptionDuration": 12,
        "startDate": null,
        "currentSubscriptionDate": "2024-03-15",
        "lastRenewalDate": null,
        "lastSubscriptionPlan": null
    }
]
New Subscription
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/company/newSubscription?id=1

PayLoad:
{
    "currentSubscriptionType":"Annually",
    "currentSubscriptionDate":"2024-03-15"
}
Renew Subscription
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/company/newSubscription?id=1
PayLoad:
{
    "currentSubscriptionType":"Annually",
    "currentSubscriptionDate":"2024-03-15"
}

Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/company/edit?id=1
Delete
Delete Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/company/delete?id=1

Subscription Type
Create
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/subscriptionType/create

Post Call
{
    "type":"Monthly",
    "durationInMonths":1


}
Response:
1
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/subscriptionType/getAll
Response:
[
    {
        "id": 1,
        "type": "Monthly",
        "durationInMonths": 1
    },
    {
        "id": 2,
        "type": "Quarterly",
        "durationInMonths": 3
    },
    {
        "id": 3,
        "type": "Annually",
        "durationInMonths": 12
    }
]

Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/subscriptionType/edit?type=Annually
Response:
{
    "type":"Annually",
    "durationInMonths":12


}

Delete
IMAGE API
Download image(Expense)
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/downloadFile/1/check-in/Exception-Handling-768.png
Get Call
Response: Image
Upload File(Expense)
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/expense/uploadFile
Put Call
{
    "fileName": "Exception-Handling-768.png",
    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
    "fileType": "image/png",
    "tag": "check-out",
    "size": 71145
}
Download image(Notes)
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/downloadFile/1/check-in/Exception-Handling-768.png
Get Call
Response: Image
Upload File(Notes)
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/notes/uploadFile
Put Call
{
    "fileName": "Exception-Handling-768.png",
    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
    "fileType": "image/png",
    "tag": "check-out",
    "size": 71145
}
Upload File
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/uploadFile
Response:
{
    "fileName": "Second.png",
    "fileDownloadUri": "http://localhost:8081/downloadFile/Second.png",
    "fileType": "image/png",
    "tag": "check-in",
    "size": 58155
}


Target
Initialize target for a month
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/target/initialize
PayLoad:
{
    "month":"June",
    "year":2024,
    "targetValue":100
}
Response:
City targets initialized
Get All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/target/getAll
Response:
[
    {
        "id": 1,
        "city": "Mumbai",
        "month": "JUNE",
        "year": 2024,
        "targetValue": 100.0
    },
    {
        "id": 2,
        "city": "Jalna",
        "month": "JUNE",
        "year": 2024,
        "targetValue": 100.0
    }
]
Get By City
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/target/getByCity?city=Jalna
Response:
[
    {
        "id": 2,
        "city": "Jalna",
        "month": "JUNE",
        "year": 2024,
        "targetValue": 100.0
    }
]
Get By Month And Year
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/target/getByMonthYear?month=June&year=2024
Response:
[
    {
        "id": 1,
        "city": "Mumbai",
        "month": "JUNE",
        "year": 2024,
        "targetValue": 100.0,
        "totalAchievements": 20.0
    },
    {
        "id": 2,
        "city": "Jalna",
        "month": "JUNE",
        "year": 2024,
        "targetValue": 50.0,
        "totalAchievements": 0.0
    }
]
Get By City And Month And Year
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/target/getByCityMonthYear?city=Jalna&month=June&year=2024
Response:
{
    "id": 2,
    "city": "Jalna",
    "month": "JUNE",
    "year": 2024,
    "targetValue": 100.0
}
Get Employees By Target Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/target/employees?cityTargetId=1
Response:
[
    {
        "id": 1,
        "employeeId": 1,
        "employeeName": "Shilpa K",
        "achievedValue": 0.0
    },
    {
        "id": 2,
        "employeeId": 2,
        "employeeName": "Shubham T",
        "achievedValue": 0.0
    }
]
Update employee Achievement
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/target/updateAchievement?employeeTargetId=1&achievedValue=20
Response:
Employee achievement updated
Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/target/edit
PayLoad:
{
    "id":2,
    "targetValue":50
}
Response:
City target edited
Travel Rate For Employee
Add Travel Rates for the employee
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/travel-rates/create
PayLoad:
{
    "employeeId":1,
    "carRatePerKm":100,
    "bikeRatePerKm":75
}
Response:
{
    "id": 1,
    "employeeId": 1,
    "employeeName": null,
    "carRatePerKm": 100.0,
    "bikeRatePerKm": 75.0,
    "createdAt": "2024-08-04",
    "createdTime": "14:25:42.5579884",
    "updatedAt": "2024-08-04",
    "updatedTime": "14:25:42.5579884"
}
Edit
Put Call
http://localhost:8081/travel-rates/edit?id=1
{
    "bikeRatePerKm":75,
    "carRatePerKm": 100.0,


}
Get All
Get Call
http://localhost:8081/travel-rates/getAll
Response:
[
    {
        "id": 1,
        "employeeId": 1,
        "employeeName": null,
        "carRatePerKm": 100.0,
        "bikeRatePerKm": 75.0,
        "createdAt": "2024-08-04",
        "createdTime": "14:25:42.558",
        "updatedAt": "2024-08-04",
        "updatedTime": "14:25:42.558"
    }
]
Get By Employee
Get Call
http://localhost:8081/travel-rates/getByEmployee?employeeId=1
Response:
{
    "id": 1,
    "employeeId": 1,
    "employeeName": null,
    "carRatePerKm": 100.0,
    "bikeRatePerKm": 75.0,
    "createdAt": "2024-08-04",
    "createdTime": "14:25:42.558",
    "updatedAt": "2024-08-04",
    "updatedTime": "14:25:42.558"
}
Travel Allowance
Edit Vehicle
Put Call
http://localhost:8081/attendance-log/editVehicle?id=1&date=2024-03-22&vehicleType=Car
Response:
Vehicle type updated successfully for Shilpa K on 2024-03-22
Get Visit List For Employee For Date Range
Get Call
http://localhost:8081/travel-allowance/getForEmployeeAndDate?employeeId=1&start=2024-03-22&end=2024-03-25
Response:
{
    "employeeId": 1,
    "vehicleType": null,
    "houseLatitude": 10.8,
    "houseLongitude": 10.5,
    "totalDistanceTravelled": 0.0,
    "visits": [
        {
            "visitId": 2,
            "checkinDate": "2024-04-13",
            "checkinTime": "12:43:38.519",
            "checkoutDate": "2024-06-06",
            "checkoutTime": "15:02:01.314",
            "checkinLatitude": null,
            "checkinLongitude": null,
            "vehicleType": "car"
        }
    ]
}
Create
Post Call
http://localhost:8081/travel-allowance/create
PayLoad:
{


    "employeeId":1,
    "date":"2024-03-22",
    "distanceTravelledByCar":10,
    "distanceTravelledByBike":10


}
Response:
1
Get For A Date Range
Get Call
http://localhost:8081/travel-allowance/getByRange?startDate=2024-03-20&endDate=2024-03-29
Response:
[
    {
        "id": 1110,
        "employeeId": 232,
        "employeeName": "Abhijeet  Kamble",
        "date": "2025-07-03",
        "distanceTravelledByCar": 0.0,
        "distanceTravelledByBike": 27.534163019187595,
        "travelAllowance": 82.60248905756279,
        "ratePerKilometerCar": 5.0,
        "ratePerKilometerBike": 3.0,
        "checkoutCount": 2
    }
]


Get Salary Summary
Get Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/salary-calculation/summary-range?startDate=2025-07-01&endDate=2025-07-31
Response:
[
    {
        "employeeName": "Avinash  Bondarwal",
        "endDate": "2025-07-31",
        "presentDays": 1,
        "baseSalary": 19354.83870967742,
        "fullDays": 22,
        "carDistanceKm": 0.0,
        "employeeId": 19,
        "absentDays": 4,
        "travelAllowance": 10636.085965422546,
        "employeeCode": "",
        "totalSalary": 30107.05370735803,
        "halfDays": 4,
        "bikeDistanceKm": 3545.3619884741806,
        "approvedExpenses": 0.0,
        "startDate": "2025-07-01",
        "dearnessAllowance": 116.12903225806451
    }
    {
        "employeeName": "Shrikant  Karad",
        "endDate": "2025-07-31",
        "presentDays": 3,
        "baseSalary": 21290.322580645163,
        "fullDays": 22,
        "carDistanceKm": 0.0,
        "employeeId": 23,
        "absentDays": 6,
        "travelAllowance": 12329.56481275201,
        "employeeCode": "",
        "totalSalary": 33726.339006300404,
        "halfDays": 0,
        "bikeDistanceKm": 4109.854937584004,
        "approvedExpenses": 0.0,
        "startDate": "2025-07-01",
        "dearnessAllowance": 106.45161290322581
    }
]





Export
Export Store Details
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/export
Response:
"Store Id","Store Name","Owner First Name","Owner Last Name","Primary Contact","City","State","Monthly Sale","Client Type","Intent","Total Visit Count","Visit This Month","Last Visit Date","Outcome Last Visit"
"1","Bunty Traders","Bunty","Kannad","9452365875","Ch.Sambhajinagar","Maharashtra","100.0","Shop","5","4","0","2024-04-25","done"
"2","Prem steel ","Sachin","Jaiswal","9422201345","Waluj","Maharashtra ","300.0","shop","10","2","0","2024-07-13","done"
"3","Sundha Steel ","Vishnu bhai","Devasi","9011816113","Dhule","Maharashtra ","","","","0","0","",""
"4","Kiran traders ","Kiran","Khurpe ","9823301003","Buldhana ","Maharashtra ","15.0","Dealer ","5","1","0","2024-04-25","done"
"5","Patel traders ","Sanjay ","Patel","9423447507","Buldhana ","Maharashtra ","","Dealer ","6","1","0","2024-04-25","done"
"6","Mauli Krupa steel ","Vaijinath ","Kadam ","9922280445","Beed ","Maharashtra ","","","5","2","0","2024-06-18","done"
"7","Harishchandra Hardware ","Sondge ","P.S sir","9403788669","Beed ","Maharashtra ","20.0","","3","2","1","2024-08-17","done"

Reports
Get Reports
Get new store count and visit count for all the new stores
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getForEmployee?startDate=2024-05-01&endDate=2024-07-30
Response:
[
    {
        "employeeName": "Shilpa K",
        "newStoreCount": 10,
        "visitCount": null,
        "storeCountDto": [
            {
                "storeId": 7,
                "visitCount": 0,
                "storeName": "1"
            },
            {
                "storeId": 9,
                "visitCount": 0,
                "storeName": "2"
            },
            {
                "storeId": 10,
                "visitCount": 0,
                "storeName": "3"
            },
            {
                "storeId": 11,
                "visitCount": 0,
                "storeName": "4"
            },
            {
                "storeId": 13,
                "visitCount": 0,
                "storeName": "5"
            },
            {
                "storeId": 14,
                "visitCount": 0,
                "storeName": "6"
            },
            {
                "storeId": 18,
                "visitCount": 0,
                "storeName": "store2"
            },
            {
                "storeId": 19,
                "visitCount": 0,
                "storeName": "store2"
            },
            {
                "storeId": 20,
                "visitCount": 0,
                "storeName": "store2"
            },
            {
                "storeId": 22,
                "visitCount": 0,
                "storeName": "store2"
            }
        ]
    }
]
Get Visit Counts
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getCounts?startDate=2024-05-01&endDate=2024-07-16
Response:
[
    {
        "weeklyCount": null,
        "monthlyCount": null,
        "yearlyCount": null,
        "uniqueStoreCount": 3,
        "fullDays": 0,
        "halfDays": 0,
        "absences": 74,
        "travelAllowance": 723.0,
        "dearnessAllowance": 7566.0,
        "salary": 300000.0,
        "expenseTotal": 850.0,
        "statsDto": {
            "visitCount": 76,
            "presentDays": 2,
            "fullDays": 0,
            "halfDays": 0,
            "absences": 74,
            "expenseTotal": 850.0,
            "approvedExpense": 0.0
        },
        "employeeId": 15,
        "employeeFirstName": "Vishal",
        "employeeLastName": "Tiwari"
    }
]
Get Monthly Sale Change History For All
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getMonthlySaleChangeForAll?startDate=2024-03-01&endDate=2024-07-16
Response:
{
    "3": [
        {
            "id": 1,
            "storeId": 3,
            "storeName": "store3",
            "oldMonthlySale": 230000.0,
            "newMonthlySale": 2000.0,
            "visitId": null,
            "visitDate": null,
            "employeeId": 3,
            "employeeName": "Jyoti T",
            "changeDate": "2024-07-02",
            "changeTime": "13:09:42.197"
        }
    ]
}
Get Monthly Sale change for a store
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getMonthlySaleChangeForStore?storeId=585&startDate=2024-05-01&endDate=2024-06-30
Response:
[
    {
        "id": 212,
        "storeId": 585,
        "storeName": "Harshal Taders",
        "oldMonthlySale": 30.0,
        "newMonthlySale": 30.0,
        "visitId": 2723,
        "visitDate": "2024-07-10",
        "employeeId": 27,
        "employeeName": "Manish  Sharma",
        "changeDate": "2024-07-10",
        "changeTime": "07:06:58.974"
    }
]
Get Monthly Sale change for a store
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getMonthlySaleChangeForStore?storeId=3
Response:
[
    {
        "id": 1,
        "storeId": 3,
        "storeName": "store3",
        "oldMonthlySale": 230000.0,
        "newMonthlySale": 2000.0,
        "visitId": 3,
        "visitDate": "2024-04-11",
        "employeeId": 3,
        "employeeName": "Jyoti T",
        "changeDate": "2024-07-02",
        "changeTime": "13:09:42.197"
    }
]
Get Intent Change History For All Stores
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getIntentChangeForAll?startDate=2024-03-01&endDate=2024-07-16
Response:
{
    "1": [
        {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "oldIntentLevel": null,
            "newIntentLevel": 3,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "changeDate": "2024-03-21",
            "changeTime": "23:35:39.756",
            "visitId": null
        }
    ]
}

Get Intent Change History For Store
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getIntentChangeForStore?storeId=1
Response:
Get Intent Change History For STore And Date Raneg
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getIntentChangeForStore?storeId=1&startDate=2024-05-01&endDate=2024-06-30
Response:
[
    {
        "id": 1,
        "storeId": 1,
        "storeName": "Bunty Traders",
        "oldIntentLevel": null,
        "newIntentLevel": 5,
        "employeeId": 15,
        "employeeName": "VishalTiwari",
        "changeDate": "2024-04-25",
        "changeTime": "07:24:53.946",
        "visitId": null
    }
]
 
Get Avg Monthly Sale And Avg Intent For Date Range
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getAvgValues?startDate=2024-06-01&endDate=2024-06-30&storeId=22
Response:
{
    "storeId": 3,
    "storeName": "store3",
    "avgMonthlySale": null,
    "avgIntent": null,
    "totalVisitCount": 2,
    "monthlySaleLogs": [
        {
            "id": 1,
            "storeId": 3,
            "storeName": "store3",
            "oldMonthlySale": 230000.0,
            "newMonthlySale": 2000.0,
            "visitId": 3,
            "visitDate": "2024-04-11",
            "employeeId": 3,
            "employeeName": "Jyoti T",
            "changeDate": "2024-07-02",
            "changeTime": "13:09:42.197"
        }
    ],
    "intentLogs": []
}
Get By Client Type For An Employee
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getByStoreType?employeeId=33&startDate=2024-05-01&endDate=2024-06-25

Response:
{
    "Others": 24,
    "shop": 5,
    "site visit": 13
}
Get Store Data
Fetch total visits, current intent level and current monthly sales for all the store
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/report/getStoreStats?employeeId=33&startDate=2024-05-01&endDate=2024-06-30
Response:
[
    {
        "storeId": 17,
        "storeName": "Jasraj",
        "visitFrequency": 25,
        "intentLevel": null,
        "monthlySales": null,
        "monthlySaleLogs": [
            {
                "id": 4,
                "storeId": 17,
                "storeName": "Jasraj",
                "oldMonthlySale": 5000.0,
                "newMonthlySale": 1000.0,
                "visitId": 612,
                "visitDate": "2024-05-18",
                "employeeId": 33,
                "employeeName": "Yash Puri",
                "changeDate": "2024-06-30",
                "changeTime": "21:02:32.824"
            }
        ],
        "intentLogs": [
            {
                "id": 563,
                "storeId": 17,
                "storeName": "Jasraj",
                "oldIntentLevel": 3,
                "newIntentLevel": 3,
                "employeeId": 33,
                "employeeName": "YashPuri",
                "changeDate": "2024-05-13",
                "changeTime": "06:58:56.746",
                "visitId": null
            }
]
},
 {
        "storeId": 33,
        "storeName": "SM traders",
        "visitFrequency": 13,
        "intentLevel": null,
        "monthlySales": null,
     
}
]




report/getStoreStats?employeeId=1 WE NEED DATERANGE & Average of monthly sales and intent








Versions
Create/ update
Put Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/version/update?versionName=2.1&url=null
Response:
{
    "id": 1,
    "versionName": "1.0.1",
    "url": "http://abc.com"
}
Get Current
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/version/current
Response:
{
    "id": 1,
    "versionName": "1.0.1",
    "url": "http://abc.com"
}
Edit
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/version/edit?url=http://abc.com&versionName=1.0.1
Response:
{
    "id": 1,
    "versionName": "1.0.1",
    "url": "http://abc.com"
}
Enquiry(Excel File Related Calls)
Upload
Post Call
http://localhost:8081/enquiry/upload
Payload:(file)
Response:
File processed successfully

Get All
http://localhost:8081/enquiry/getAll
Response:
[
    {
        "id": 66,
        "taluka": "Akole",
        "population": 291950,
        "dealerName": "IRV Traders",
        "expenses": 37992.0,
        "contactNumber": "9975557203",
        "fileName": "Dealer_Sales_Data.xlsx",
        "sheetName": "Dealer Data",
        "sales": {
            "Jan-25": 13.0,
            "Dec-24": 20.0
        }
    }

Get By Range
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/enquiry/range?startMonth=Jan-25&endMonth=Feb-25
Response:
[
    {
        "fileName": "Dealer_Sales_Data.xlsx",
        "dealerName": "MS Steel Traders - Ahmednagar",
        "sheetName": "Dealer Data",
        "taluka": "Ahmednagar",
        "contactNumber": "91929311188",
        "id": 67,
        "sales": {
            "Mar-25": 5.0
        }
    }


Get visit stats
Get Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/visit/field-officer-stats?employeeId=19&startDate=2025-05-15&endDate=2025-05-25
Response:
{
    "totalVisits": 56,
    "attendanceStats": {
        "absences": 3,
        "halfDays": 2,
        "fullDays": 5
    },
    "completedVisits": 46,
    "visitsByCustomerType": {
        "shop": 45,
        "site visit": 3
    }
}
Get visit details by store type and employee Id
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/visit/customer-visit-details?employeeId=19&startDate=2025-05-15&endDate=2025-05-25&customerType=shop

http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/visit/customer-visit-details?employeeId=19&startDate=2025-05-15&endDate=2025-05-25&customerType=others

Get Call
Response:
[
    {
        "avgIntentLevel": 6.0,
        "avgMonthlySales": 50.0,
        "visitCount": 1,
        "lastVisited": "2025-05-15",
        "city": "Aurangabad ",
        "taluka": "Chavni",
“storeId:1;
        "state": "Maharashtra",
        "customerName": "Pranav trd chavni"
    }
]
Filter in enquiry
Get Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/enquiry/filter?storeName=ABC Store&taluka=Mumbai&sheetName=Sheet1&fileName=Sales2024.xlsx
Response:
[
    {
        "id": 66,
        "taluka": "Akole",
        "population": 291950,
        "dealerName": "IRV Traders",
        "expenses": 37992.0,
        "contactNumber": "9975557203",
        "fileName": "Dealer_Sales_Data.xlsx",
        "sheetName": "Dealer Data",
        "sales": {
            "Jan-25": 13.0,
            "Dec-24": 20.0
        }
    }
]
Paginated Get All
Get Call
http://localhost:8081/enquiry/getAllPaginated
Response:
{
    "content": [
        {
            "id": 66,
            "taluka": "Akole",
            "population": 291950,
            "dealerName": "IRV Traders",
            "expenses": 38123.0,
            "contactNumber": "9975557203",
            "fileName": "Dealer_Sales_Data.xlsx",
            "sheetName": "Dealer Data",
            "sales": {
                "Jan-25": 13.0,
                "Dec-24": 20.0,
                "Jul-25": 22.0
            }
        }
    ],
    "pageable": {
        "pageNumber": 0,
        "pageSize": 10,
        "sort": {
            "empty": false,
            "unsorted": false,
            "sorted": true
        },
        "offset": 0,
        "paged": true,
        "unpaged": false
    },
    "last": true,
    "totalPages": 1,
    "totalElements": 10,
    "size": 10,
    "number": 0,
    "sort": {
        "empty": false,
        "unsorted": false,
        "sorted": true
    },
    "numberOfElements": 10,
    "first": true,
    "empty": false
}
Multilevel Filtering
Get Call
http://localhost:8081/enquiry/filtered?storeName=ABC%20Store&taluka=Mumbai&city=Mumbai&state=Maharashtra&startMonthYear=Jan-24&endMonthYear=Dec-24&sortByStoreCount=false&page=0&size=5&sortBy=dealerName&direction=asc


Response:
[
    {
        "id": 70,
        "taluka": "Ahmednagar",
        "dealerName": "SainandTrd",
        "expenses": 200.0,
        "fileName": "Dealer_Sales_Data.xlsx",
        "sheetName": "Dealer Data",
        "sales": {
            "Feb-25": 20.0
        }
    }
]
Sort By (State, City, Taluka and either sales Count or Store Name)
Get Call
http://ec2-3-88-111-83.compute-1.amazonaws.com:8081/enquiry/sorted?sortByOccurrences=true
Response:
[
    {
        "id": 65,
        "taluka": "70",
        "dealerName": "150000",
        "fileName": "Testcase1.xlsx",
        "sheetName": "Sheet1",
        "sales": {},
        "storeCount": 0
    },
    {
        "id": 71,
        "taluka": "70",
        "dealerName": "150000",
        "contactNumber": "15000",
        "fileName": "Test3.xlsx",
        "sheetName": "Sheet1",
        "sales": {},
        "storeCount": 0
    },
]



NESTED RESPONSE - EXPORT
Get By Id
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/nested-response/getById?id=1
Response:
{
    "visitDto": [
        {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "storeLatitude": 10.0,
            "storeLongitude": -23.0,
            "intent": 3,
            "storePrimaryContact": 123456,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "visit_date": "2024-03-21",
            "scheduledStartTime": null,
            "scheduledEndTime": null,
            "visitLatitude": 10.0,
            "visitLongitude": -23.0,
            "checkinLatitude": 20.0,
            "checkinLongitude": -20.0,
            "checkoutLatitude": null,
            "checkoutLongitude": null,
            "checkinDate": "2024-03-22",
            "checkoutDate": "2024-03-22",
            "checkinTime": "13:23:18.015",
            "checkoutTime": "13:33:34.323",
            "purpose": "Follow Up",
            "priority": "low",
            "outcome": "done",
            "feedback": null,
            "attachment": [],
            "attachmentResponse": [
                {
                    "fileName": "Second.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Second.png",
                    "fileType": "image/png",
                    "tag": "check-in",
                    "size": 0
                },
                {
                    "fileName": "Exception-Handling-768.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                    "fileType": "image/png",
                    "tag": "check-in",
                    "size": 0
                }
            ],
            "visitIntentId": null,
            "visitIntentValue": null,
            "createdAt": "2024-03-22",
            "createdTime": "12:21:01.271",
            "updatedAt": "2024-03-22",
            "updatedTime": "12:21:01.271",
            "intentAuditLogDto": {
                "id": 1,
                "storeId": 1,
                "storeName": "store1",
                "oldIntentLevel": null,
                "newIntentLevel": 3,
                "employeeId": 1,
                "employeeName": "ShilpaK",
                "changeDate": "2024-03-21",
                "changeTime": "23:35:39.756",
                "visitId": null
            }
        },
        {
            "id": 2,
            "storeId": 1,
            "storeName": "store1",
            "storeLatitude": 10.0,
            "storeLongitude": -23.0,
            "intent": 3,
            "storePrimaryContact": 123456,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "visit_date": "2024-03-23",
            "scheduledStartTime": null,
            "scheduledEndTime": null,
            "visitLatitude": 10.0,
            "visitLongitude": -23.0,
            "checkinLatitude": null,
            "checkinLongitude": null,
            "checkoutLatitude": null,
            "checkoutLongitude": null,
            "checkinDate": "2024-04-13",
            "checkoutDate": null,
            "checkinTime": "12:43:38.519",
            "checkoutTime": null,
            "purpose": "Follow Up",
            "priority": "low",
            "outcome": null,
            "feedback": null,
            "attachment": [],
            "attachmentResponse": [],
            "visitIntentId": null,
            "visitIntentValue": null,
            "createdAt": "2024-03-22",
            "createdTime": "12:21:17.22",
            "updatedAt": "2024-03-22",
            "updatedTime": "12:21:17.22",
            "intentAuditLogDto": {
                "id": 1,
                "storeId": 1,
                "storeName": "store1",
                "oldIntentLevel": null,
                "newIntentLevel": 3,
                "employeeId": 1,
                "employeeName": "ShilpaK",
                "changeDate": "2024-03-21",
                "changeTime": "23:35:39.756",
                "visitId": null
            }
        }
    ],
    "notesDto": [],
    "expenseDto": [
        {
            "id": 1,
            "type": "travel",
            "subType": "bike",
            "amount": 300.0,
            "approvalPersonId": 2,
            "approvalPersonName": "Shubham T",
            "approvalStatus": "Rejected",
            "description": "desc",
            "approvalDate": "2024-03-22",
            "submissionDate": null,
            "rejectionReason": "Reason",
            "reimbursedDate": "2023-03-23",
            "reimbursementAmount": 200.0,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "expenseDate": "2024-03-21",
            "paymentMethod": null,
            "attachment": [],
            "attachmentResponse": [
                {
                    "fileName": "Exception-Handling-768.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                    "fileType": "image/png",
                    "tag": "check-in",
                    "size": 0
                },
                {
                    "fileName": "Exception-Handling-768.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                    "fileType": "image/png",
                    "tag": "check-out",
                    "size": 0
                },
                {
                    "fileName": "Exception-Handling-768.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                    "fileType": "image/png",
                    "tag": "check-in",
                    "size": 0
                }
            ]
        }
    ],
    "taskDto": [],
    "storeDto": [
        {
            "landmark": null,
            "district": null,
            "subDistrict": null,
            "managers": [],
            "latitude": 10.0,
            "longitude": -23.0,
            "intent": 3,
            "brandsInUse": [],
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "monthlySale": 230000.0,
            "brandProCons": [],
            "clientType": "shop",
            "totalVisitCount": 2,
            "visitThisMonth": 2,
            "lastVisitDate": "2024-04-13",
            "outcomeLastVisit": null,
            "createdAt": "2024-03-21",
            "updatedAt": "2024-03-21",
            "createdTime": null,
            "updatedTime": null,
            "storeId": 1,
            "storeName": "store1",
            "clientFirstName": "abcd",
            "clientLastName": "abcd",
            "primaryContact": 123456,
            "secondaryContact": 123456,
            "email": "abc@gmail.com",
            "industry": "industry2",
            "companySize": 55,
            "gstNumber": "gst12356",
            "addressLine1": "addressLine1",
            "addressLine2": "addressLine2",
            "city": "Mumbai",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "likes": {}
        }
    ],
    "employeeDto": {
        "id": 1,
        "firstName": "Shilpa",
        "lastName": "K",
        "employeeId": "E101",
        "primaryContact": 9892868637,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": "23:19:26.173",
        "updatedTime": "23:19:26.173",
        "companyId": null,
        "companyName": null
    }
}
Get By Range
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/nested-response/getByRange?id=1&start=2024-03-21&end=2024-03-30
Response:
{
    "visitDto": [
        {
            "id": 1,
            "storeId": 1,
            "storeName": "store1",
            "storeLatitude": 10.0,
            "storeLongitude": -23.0,
            "intent": 3,
            "storePrimaryContact": 123456,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "visit_date": "2024-03-21",
            "scheduledStartTime": null,
            "scheduledEndTime": null,
            "visitLatitude": 10.0,
            "visitLongitude": -23.0,
            "checkinLatitude": 20.0,
            "checkinLongitude": -20.0,
            "checkoutLatitude": null,
            "checkoutLongitude": null,
            "checkinDate": "2024-03-22",
            "checkoutDate": "2024-03-22",
            "checkinTime": "13:23:18.015",
            "checkoutTime": "13:33:34.323",
            "purpose": "Follow Up",
            "priority": "low",
            "outcome": "done",
            "feedback": null,
            "attachment": [],
            "attachmentResponse": [
                {
                    "fileName": "Second.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Second.png",
                    "fileType": "image/png",
                    "tag": "check-in",
                    "size": 0
                },
                {
                    "fileName": "Exception-Handling-768.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                    "fileType": "image/png",
                    "tag": "check-in",
                    "size": 0
                }
            ],
            "visitIntentId": null,
            "visitIntentValue": null,
            "createdAt": "2024-03-22",
            "createdTime": "12:21:01.271",
            "updatedAt": "2024-03-22",
            "updatedTime": "12:21:01.271",
            "intentAuditLogDto": {
                "id": 1,
                "storeId": 1,
                "storeName": "store1",
                "oldIntentLevel": null,
                "newIntentLevel": 3,
                "employeeId": 1,
                "employeeName": "ShilpaK",
                "changeDate": "2024-03-21",
                "changeTime": "23:35:39.756",
                "visitId": null
            }
        },
        {
            "id": 2,
            "storeId": 1,
            "storeName": "store1",
            "storeLatitude": 10.0,
            "storeLongitude": -23.0,
            "intent": 3,
            "storePrimaryContact": 123456,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "visit_date": "2024-03-23",
            "scheduledStartTime": null,
            "scheduledEndTime": null,
            "visitLatitude": 10.0,
            "visitLongitude": -23.0,
            "checkinLatitude": null,
            "checkinLongitude": null,
            "checkoutLatitude": null,
            "checkoutLongitude": null,
            "checkinDate": "2024-04-13",
            "checkoutDate": null,
            "checkinTime": "12:43:38.519",
            "checkoutTime": null,
            "purpose": "Follow Up",
            "priority": "low",
            "outcome": null,
            "feedback": null,
            "attachment": [],
            "attachmentResponse": [],
            "visitIntentId": null,
            "visitIntentValue": null,
            "createdAt": "2024-03-22",
            "createdTime": "12:21:17.22",
            "updatedAt": "2024-03-22",
            "updatedTime": "12:21:17.22",
            "intentAuditLogDto": {
                "id": 1,
                "storeId": 1,
                "storeName": "store1",
                "oldIntentLevel": null,
                "newIntentLevel": 3,
                "employeeId": 1,
                "employeeName": "ShilpaK",
                "changeDate": "2024-03-21",
                "changeTime": "23:35:39.756",
                "visitId": null
            }
        }
    ],
    "notesDto": [],
    "expenseDto": [
        {
            "id": 1,
            "type": "travel",
            "subType": "bike",
            "amount": 300.0,
            "approvalPersonId": 2,
            "approvalPersonName": "Shubham T",
            "approvalStatus": "Rejected",
            "description": "desc",
            "approvalDate": "2024-03-22",
            "submissionDate": null,
            "rejectionReason": "Reason",
            "reimbursedDate": "2023-03-23",
            "reimbursementAmount": 200.0,
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "expenseDate": "2024-03-21",
            "paymentMethod": null,
            "attachment": [],
            "attachmentResponse": [
                {
                    "fileName": "Exception-Handling-768.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                    "fileType": "image/png",
                    "tag": "check-in",
                    "size": 0
                },
                {
                    "fileName": "Exception-Handling-768.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                    "fileType": "image/png",
                    "tag": "check-out",
                    "size": 0
                },
                {
                    "fileName": "Exception-Handling-768.png",
                    "fileDownloadUri": "http://localhost:8081/downloadFile/Exception-Handling-768.png",
                    "fileType": "image/png",
                    "tag": "check-in",
                    "size": 0
                }
            ]
        }
    ],
    "taskDto": [],
    "storeDto": [
        {
            "landmark": null,
            "district": null,
            "subDistrict": null,
            "managers": [],
            "latitude": 10.0,
            "longitude": -23.0,
            "intent": 3,
            "brandsInUse": [],
            "employeeId": 1,
            "employeeName": "Shilpa K",
            "monthlySale": 230000.0,
            "brandProCons": [],
            "clientType": "shop",
            "totalVisitCount": 2,
            "visitThisMonth": 2,
            "lastVisitDate": "2024-04-13",
            "outcomeLastVisit": null,
            "createdAt": "2024-03-21",
            "updatedAt": "2024-03-21",
            "createdTime": null,
            "updatedTime": null,
            "storeId": 1,
            "storeName": "store1",
            "clientFirstName": "abcd",
            "clientLastName": "abcd",
            "primaryContact": 123456,
            "secondaryContact": 123456,
            "email": "abc@gmail.com",
            "industry": "industry2",
            "companySize": 55,
            "gstNumber": "gst12356",
            "addressLine1": "addressLine1",
            "addressLine2": "addressLine2",
            "city": "Mumbai",
            "state": "Maharashtra",
            "country": "India",
            "pincode": 410206,
            "likes": {}
        }
    ],
    "employeeDto": {
        "id": 1,
        "firstName": "Shilpa",
        "lastName": "K",
        "employeeId": "E101",
        "primaryContact": 9892868637,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": "23:19:26.173",
        "updatedTime": "23:19:26.173",
        "companyId": null,
        "companyName": null
    }
}



To Be Added:

http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/store/getAll
Last Visit Date
Last Visit Outcome
Total Visits
Total Visits this Month (Last 30 Days from current date)
Remove notes
Purpose predefined
Brands Pros cons delete and Likes Delete 
clientType class
Visits
Scheduled Start DateTime and End DateTime
Actual Start DateTime and End DateTime
Priority
Check in for visit
Input: start date time, check in latitude, longitude, 
Checkout for visit : end date time, check out latitude, checkout longitude, outcome, feedback
Visits/getbystoreID and getbyid should have intent fetched for that visit from audit log
Employee Hierarchy(heirarchy created in entity only)
Manager who manages Field Officers
Manager will create
User Name and Password for Field Officers (Create, Delete, Reset)
Set Status of Employees (Active, Inactive)
Update Field Officer single or bulk
Employee Roles Class
Custom  FIelds in Customer and Visits	
Notes (Later)
Attachments (Doc and images)
Designation for employee - separate class
Visit Get: Intent
Expenses: category of approval: can be set for different client
Attendance: custom rules:
Check in check out based
Visit based(again it customized for each company)
Change findAll() in all classes to fetch current company data only
Change clientType for different client with company 


Custom Fields:
In Employee: roles(field officer, office manager)
In Visit: purpose(Follow Up, First Visit)
In Client/ store: client type(shop, project)




GST1!= GST2 or INV1 != INV2

New Users(After adding company):
{
    "username":"SalesAdmin",
    "password":"Sales123",
    "roles":"ADMIN"
}
{
    "username":"Shilpa",
    "password":"Shilpa123",
    "roles":"DEVELOPER"
}


Get Call

http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/downloadFile/Exception-Handling-768.png

Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/uploadFile


Response
[
    {
        "id": 1,
        "firstName": "Shilpa",
        "lastName": "K",
        "employeeId": "E101",
        "primaryContact": 9892868637,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": null,
        "createdAt": "2024-03-16",
        "updatedAt": "2024-03-26",
        "createdTime": "08:39:04.44",
        "updatedTime": "07:43:15.981",
        "companyId": null,
        "companyName": null
    },
    {
        "id": 2,
        "firstName": "Sarthak",
        "lastName": "Borade",
        "employeeId": "E102",
        "primaryContact": 8104846414,
        "secondaryContact": null,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": null,
        "createdAt": "2024-03-16",
        "updatedAt": "2024-03-16",
        "createdTime": "08:39:56.53",
        "updatedTime": "12:19:10.124",
        "companyId": null,
        "companyName": null
    },
    {
        "id": 3,
        "firstName": "Ana",
        "lastName": "mmm",
        "employeeId": "eeeeee",
        "primaryContact": 6543219876,
        "secondaryContact": 9867543210,
        "departmentName": "Office",
        "email": "guptapayal8820@gmail.com",
        "role": "Office Manager",
        "addressLine1": "C/o chirag nivas Nisarga layout 6th cross basavanpura main road kr puram",
        "addressLine2": "Gayathri layout, kr puram",
        "city": "BANGALORE",
        "state": "Karnataka",
        "country": "India",
        "pincode": 560036,
        "dateOfJoining": null,
        "createdAt": "2024-03-18",
        "updatedAt": "2024-03-26",
        "createdTime": "07:56:01.191",
        "updatedTime": "07:16:25.458",
        "companyId": null,
        "companyName": null
    },
    {
        "id": 4,
        "firstName": "Shubham",
        "lastName": "T",
        "employeeId": "E105",
        "primaryContact": 7977953937,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@t.com",
        "role": "Office Manager",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "createdAt": "2024-03-23",
        "updatedAt": "2024-03-23",
        "createdTime": "08:54:54.678",
        "updatedTime": "08:54:54.678",
        "companyId": null,
        "companyName": null
    },
    {
        "id": 5,
        "firstName": "Payal",
        "lastName": "Gupta",
        "employeeId": "error1234",
        "primaryContact": 7019339764,
        "secondaryContact": 8104846414,
        "departmentName": "",
        "email": "guptapayal8820@gmail.com",
        "role": "Field Officer",
        "addressLine1": "C/o chirag nivas Nisarga layout 6th cross basavanpura main road kr puram",
        "addressLine2": "Gayathri layout, kr puram",
        "city": "BANGALORE",
        "state": "Karnataka",
        "country": "India",
        "pincode": 560036,
        "dateOfJoining": null,
        "createdAt": "2024-03-26",
        "updatedAt": "2024-03-26",
        "createdTime": "07:23:12.286",
        "updatedTime": "07:43:46.369",
        "companyId": null,
        "companyName": null
    },
    {
        "id": 6,
        "firstName": "Suhas",
        "lastName": "K",
        "employeeId": "dnnsndsnd2233",
        "primaryContact": 9878989878,
        "secondaryContact": 9988998898,
        "departmentName": "Office",
        "email": "guptapayal8820@gmail.com",
        "role": "Office Manager",
        "addressLine1": "C/o chirag nivas Nisarga layout 6th cross basavanpura main road kr puram",
        "addressLine2": "Gayathri layout, kr puram",
        "city": "BANGALORE",
        "state": "Karnataka",
        "country": "India",
        "pincode": 560036,
        "dateOfJoining": "2024-03-27",
        "createdAt": "2024-03-26",
        "updatedAt": "2024-03-26",
        "createdTime": "16:41:47.399",
        "updatedTime": "16:41:47.399",
        "companyId": null,
        "companyName": null
    },
    {
        "id": 7,
        "firstName": "Sangeet",
        "lastName": "S",
        "employeeId": "dnnsndsnd2231",
        "primaryContact": 9999999999,
        "secondaryContact": 8888888888,
        "departmentName": "",
        "email": "guptapayal8820@gmail.com",
        "role": "Field Officer",
        "addressLine1": "C/o chirag nivas Nisarga layout 6th cross basavanpura main road kr puram",
        "addressLine2": "Gayathri layout, kr puram",
        "city": "BANGALORE",
        "state": "Karnataka",
        "country": "India",
        "pincode": 560036,
        "dateOfJoining": "2024-03-27",
        "createdAt": "2024-03-26",
        "updatedAt": "2024-03-26",
        "createdTime": "16:47:07.915",
        "updatedTime": "16:47:07.915",
        "companyId": null,
        "companyName": null
    }
]

Team:
{
    "officeManager":4,
    "fieldOfficers": [1,2]
}
Field officer login:
{
    "username":"Shilpa",
    "password":"Shilpa123",
    "employeeId":1
}


{
    "username":"Yash",
    "password":"Yash123",
    "employeeId":57
}




To be added:

1) Get Visits For a Date Range by employee ID

2) Get all stores by employee ID


http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/downloadFile/32/check-in/0FF92EA8-967B-4FF2-847A-A96EDDBE46D5.jpg

To be removed (attachment response)
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/visit/getByStore?id

store/getById
store/getByEmployee
Last visit id
Last visit outcome



Dashboard

I should see States -> 



States Cards  (Date Filters) -> Employee Cards (Total Visits) (Date Filters) (Back Button) -> Employee stats (Date filters, City filters, table of visits then chart)


Visit Page:
Customer Name : Blank spaces
Employee Name: concat spaces
Purpose: Fuzzy search

Customer List
-   City: partial match
Shop Name: partial match,  concat spaces
Owner Name: concat spaces
Phone : partial number
Client type: partial match


http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/getForRange?start=2024-05-31&end=2024-06-29





Call 1:
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/getForRange1?start=2024-04-01&end=2024-04-30
Response:
[
    {
        "id": 1,
        "employeeId": 15,
        "employeeName": "Vishal Tiwari",
        "attendanceStatus": "half day",
        "visitCount": 2,
        "uniqueStoreCount": null,
        "travelAllowance": null,
        "dearnessAllowance": null,
        "checkinDate": "2024-04-25",
        "checkoutDate": "2024-04-25",
        "checkinTime": "07:23:19.655",
        "checkoutTime": "07:44:41.528",
        "fullMonthSalary": null
    }
]
Call 2:
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/getForRange?start=2024-04-01&end=2024-04-30

Response:
[
    {
        "weeklyCount": null,
        "monthlyCount": null,
        "yearlyCount": null,
        "uniqueStoreCount": 0,
        "fullDays": 0,
        "halfDays": 0,
        "absences": 5,
        "travelAllowance": 0.0,
        "dearnessAllowance": 0.0,
        "salary": null,
        "expenseTotal": 0.0,
        "statsDto": {
            "visitCount": 5,
            "presentDays": 0,
            "fullDays": 0,
            "halfDays": 0,
            "absences": 5,
            "expenseTotal": 0.0,
            "approvedExpense": 0.0
        },
        "employeeId": 31,
        "employeeFirstName": "Pranit ",
        "employeeLastName": "Shinde"
    }
]

Employee Hierarchy
Get All Field Officers
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getFieldOfficer
Response:
[
    {
        "id": 1,
        "firstName": "Shilpa",
        "lastName": "K",
        "employeeId": "E101",
        "primaryContact": 9892868637,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "userDto": {
            "username": "Shilpa",
            "password": null,
            "plainPassword": null,
            "roles": null,
            "employeeId": null,
            "firstName": null,
            "lastName": null
        },
        "assignedCity": null,
        "travelAllowance": 100.0,
        "dearnessAllowance": 100.0,
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": "23:19:26.173",
        "updatedTime": "23:19:26.173",
        "companyId": null,
        "companyName": null,
        "fullMonthSalary": 6000.0
    }
]
Get All Office Manager
Get Call
http://localhost:8081/employee/getOfficeManager
Response:
[
    {
        "id": 2,
        "firstName": "Shubham",
        "lastName": "T",
        "employeeId": "E102",
        "primaryContact": 7977953937,
        "secondaryContact": null,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Office Manager",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-20",
        "userDto": null,
        "assignedCity": null,
        "travelAllowance": null,
        "dearnessAllowance": null,
        "createdAt": "2024-03-22",
        "updatedAt": "2024-03-22",
        "createdTime": "21:23:51.782",
        "updatedTime": "21:23:51.782",
        "companyId": null,
        "companyName": null,
        "fullMonthSalary": null
    }
]
Get Field Officers By City
Get Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/getFieldOfficerByCity?city=Mumbai
Response:
[
    {
        "id": 1,
        "firstName": "Shilpa",
        "lastName": "K",
        "employeeId": "E101",
        "primaryContact": 9892868637,
        "secondaryContact": 8104846414,
        "departmentName": "Sales",
        "email": "s@k.com",
        "role": "Field Officer",
        "addressLine1": "address1",
        "addressLine2": "address2",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 410206,
        "dateOfJoining": "2017-01-12",
        "userDto": {
            "username": "Shilpa",
            "password": null,
            "plainPassword": null,
            "roles": null,
            "employeeId": null,
            "firstName": null,
            "lastName": null
        },
        "assignedCity": null,
        "travelAllowance": 100.0,
        "dearnessAllowance": 100.0,
        "createdAt": "2024-03-21",
        "updatedAt": "2024-03-21",
        "createdTime": "23:19:26.173",
        "updatedTime": "23:19:26.173",
        "companyId": null,
        "companyName": null,
        "fullMonthSalary": 6000.0
    }
]
Assign City to Office Manager
Put Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/assignCity?id=2&city=Mumbai
Response:
Mumbai assigned to Employee Id: 2

Create Team
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee/team/create
Response:
{
    "officeManager":6,
    "fieldOfficers": [3]
}


Error Response:
Error Creating Team: Field Officer 3 is not in the same city as the office manager




Create Login for Manager
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/employee-user/create
PayLoad:
{
  "user": {
    "username":"Abc",
    "password":"Abc123"
  },
  "employee": {
    "firstName":"Manager",
    "lastName":"1",
    "employeeId":"E106",
    "primaryContact":8080,
    "secondaryContact":8104846414,
    "departmentName":"Sales",    
    "email":"s@k.com",
    "role":"manager",
    "addressLine1":"address1",
    "addressLine2":"address2",
    "city":"Mumbai",
    "state":"Maharashtra",
    "country":"India",
    "pincode":410206,
    "dateOfJoining":"2017-01-12"
  }
}


Login With Credentials For Manager
Post Call
http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/user/token
PayLoad:
 {
    "username":"Abc",
    "password":"Abc123"
  }

Response:
MANAGER eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IkFiYyIsImlhdCI6MTcxOTU1NjY1NCwiZXhwIjoxNzE5NTY4NjU0fQ.RDxKB6pQd0BUL2uNfDzKpE2yQdBfUXYSIXdath4xKVkLvIQqTSgO971A_z4yVhg2qHtBttwXQTP9BVfBLBRJkg



To be added:
Brands, Intent level, Monthly sales must be linked to a visit
Tasks should have ability to add upto 5 images



http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/attendance-log/getForRange?start=2024-08-01&end=2024-08-04
















  

http://localhost:8081/travel-allowance/getForEmployeeAndDate?employeeId=1&start=2024-03-22&end=2024-03-29

{
    "employeeId": 1,
    "houseLatitude": 10.8,
    "houseLongitude": 10.5,
    "dateDetails": [
        {
            "date": "2024-03-23",
            "totalDistanceTravelled": 0.0,
            "checkoutCount": 1,
            "visitDetails": [
                {
                    "visitId": 2,
                    "checkinDate": "2024-04-13",
                    "checkoutDate": "2024-06-06",
                    "checkinTime": "12:43:38.519",
                    "checkoutTime": "15:02:01.314",
                    "checkinLatitude": 0.0,
                    "checkinLongitude": 0.0,
                    "vehicleType": "Bike"
                }
            ]
        }
    ]
}




http://ec2-51-20-32-8.eu-north-1.compute.amazonaws.com:8081/travel-allowance/getForEmployeeAndDate?employeeId=19&start=2024-08-01&end=2024-08-31





—-----------------------------------------------------------------------------------------------------------
Employee
|  92 | Shubham    | Office Manager | NULL        | inactive |     252 |

Login
| 252 | OFFICE MANAGER | Shubham212 | Shubham@1117   |


