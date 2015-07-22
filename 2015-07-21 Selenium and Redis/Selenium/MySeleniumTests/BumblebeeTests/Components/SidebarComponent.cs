using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bumblebee.Implementation;
using Bumblebee.Interfaces;
using Bumblebee.Setup;
using OpenQA.Selenium;

namespace BumblebeeTests.Components
{
    interface ISidebarComponent<T> : IBlock where T : WebBlock
    {
        
    }
    static class SidebarComponent
    {

        public static IClickable<T> DownloadButton<T>(this ISidebarComponent<T> sidebar)  where T : WebBlock
        {
            return new Clickable<T>(sidebar, By.CssSelector(".downloadBox a")); 
        }
    }
}
