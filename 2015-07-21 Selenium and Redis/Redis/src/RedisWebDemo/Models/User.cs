﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace RedisWebDemo.Models
{
    [Serializable]
    public class User
    {
        public string Id { get; set; }
        public string Name { get; set; }
    }
}